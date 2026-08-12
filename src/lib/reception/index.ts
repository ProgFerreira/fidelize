import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import {
  simulateBenefit,
  applyGiftCardToSimulation,
  computeAvailabilityDates,
  getBenefitSettings,
  type SimulationResult,
} from "@/lib/cashback";
import { creditWallet, redeemFromWallet, reverseLedgerEntry } from "@/lib/ledger";
import { recalculateCategory } from "@/lib/categories";
import { writeAuditLog } from "@/lib/audit";
import { money, moneyToString } from "@/lib/money";
import { organizacaoAtual } from "@/lib/tenant";
import {
  giftCardCodeFromPaymentKey,
  quoteGiftCardForSale,
  redeemGiftCardInTx,
  restoreGiftCardForAppointment,
} from "@/lib/giftcards";
import { parsePdvPaymentMethod } from "@/lib/payments/methods";

async function applyOptionalGiftCard(input: {
  clinicId: string;
  simulation: SimulationResult;
  giftCardCode?: string | null;
  giftCardAmount?: number | null;
}) {
  const code = input.giftCardCode?.trim();
  if (!code) {
    return { simulation: input.simulation, gift: null as null };
  }
  const quote = await quoteGiftCardForSale({
    clinicId: input.clinicId,
    code,
    amountDue: Number(input.simulation.paidAmount),
    requestedAmount: input.giftCardAmount,
  });
  return {
    simulation: applyGiftCardToSimulation(
      input.simulation,
      quote.amount,
      quote.card.code,
    ),
    gift: quote,
  };
}

export async function confirmAppointment(params: {
  clinicId: string;
  unitId?: string | null;
  patientId: string;
  walletId: string;
  procedureId?: string | null;
  operatorId: string;
  professionalName?: string;
  grossAmount: number;
  discountAmount?: number;
  benefitToUse?: number;
  campaignId?: string | null;
  idempotencyKey?: string;
  notes?: string;
  giftCardCode?: string | null;
  giftCardAmount?: number | null;
  paymentMethod?: string | null;
  items?: Array<{
    procedureId?: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
    professionalName?: string | null;
  }>;
}) {
  const key = params.idempotencyKey || randomUUID();

  const existing = await prisma.appointment.findUnique({
    where: { clinicId_idempotencyKey: { clinicId: params.clinicId, idempotencyKey: key } },
  });
  if (existing) return { appointment: existing, reused: true };

  const wallet = await prisma.wallet.findFirst({
    where: {
      id: params.walletId,
      clinicId: params.clinicId,
      patientId: params.patientId,
      status: "ACTIVE",
    },
    include: { category: true },
  });
  if (!wallet) throw new Error("Carteira inválida");

  const cartItems = (params.items ?? [])
    .map((item) => ({
      procedureId: item.procedureId || null,
      name: item.name.trim(),
      unitPrice: Number(item.unitPrice),
      quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      professionalName: item.professionalName || params.professionalName || null,
    }))
    .filter((item) => item.name && item.unitPrice >= 0 && item.quantity > 0);

  if (cartItems.length === 0 && !params.procedureId && !(params.grossAmount > 0)) {
    throw new Error("Adicione ao menos um serviço no carrinho");
  }

  const procedureIds = [
    ...new Set(
      cartItems
        .map((i) => i.procedureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (params.procedureId) procedureIds.push(params.procedureId);

  const procedures = procedureIds.length
    ? await prisma.procedure.findMany({
        where: { clinicId: params.clinicId, id: { in: [...new Set(procedureIds)] } },
      })
    : [];
  const procedureById = Object.fromEntries(procedures.map((p) => [p.id, p]));

  const primaryProcedureId =
    params.procedureId ||
    cartItems.find((i) => i.procedureId)?.procedureId ||
    null;
  const primaryProcedure = primaryProcedureId
    ? procedureById[primaryProcedureId] ?? null
    : null;

  let procedureCashbackPercent: number | null = null;
  if (cartItems.length > 0) {
    let weight = 0;
    let total = 0;
    for (const item of cartItems) {
      const line = item.unitPrice * item.quantity;
      total += line;
      const pct = item.procedureId
        ? procedureById[item.procedureId]?.cashbackPercent
        : null;
      if (pct != null) weight += line * Number(pct);
    }
    procedureCashbackPercent = total > 0 && weight > 0 ? weight / total : null;
  } else if (primaryProcedure?.cashbackPercent != null) {
    procedureCashbackPercent = Number(primaryProcedure.cashbackPercent);
  }

  const cartGross =
    cartItems.length > 0
      ? cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
      : params.grossAmount;

  const campaign = params.campaignId
    ? await prisma.campaign.findFirst({
        where: { id: params.campaignId, clinicId: params.clinicId, status: "ACTIVE" },
      })
    : null;

  const baseSimulation = await simulateBenefit({
    clinicId: params.clinicId,
    categoryCashbackPercent: wallet.category
      ? Number(wallet.category.cashbackPercent)
      : null,
    procedureCashbackPercent,
    campaignExtraPercent: campaign ? Number(campaign.extraCashbackPct) : null,
    grossAmount: cartGross,
    discountAmount: params.discountAmount ?? 0,
    benefitToUse: params.benefitToUse ?? 0,
    availableBalance: Number(wallet.availableBalance),
  });

  const { simulation: withGift, gift } = await applyOptionalGiftCard({
    clinicId: params.clinicId,
    simulation: baseSimulation,
    giftCardCode: params.giftCardCode,
    giftCardAmount: params.giftCardAmount,
  });
  const settledAmount = money(baseSimulation.paidAmount);
  const giftUsed = money(withGift.giftCardAmount ?? 0);

  const simulation = { ...withGift };
  let acceleratorIds: string[] = [];
  try {
    const { applyAcceleratorBonus } = await import("@/lib/accelerators");
    const { isModuleEnabled } = await import("@/lib/modules");
    if (await isModuleEnabled(params.clinicId, "ACCELERATORS")) {
      const accel = await applyAcceleratorBonus({
        clinicId: params.clinicId,
        baseCashbackPct: 0,
        basePoints: simulation.points,
        paidAmount: Number(simulation.paidAmount),
        procedureId: primaryProcedureId,
        unitId: params.unitId,
        categoryId: wallet.categoryId,
      });
      acceleratorIds = accel.applied;
      simulation.points = accel.points;
      if (accel.cashbackPct > 0 || accel.bonusFixedAmount > 0) {
        const extra = money(simulation.paidAmount)
          .mul(accel.cashbackPct)
          .div(100)
          .plus(accel.bonusFixedAmount);
        simulation.cashbackAmount = moneyToString(
          money(simulation.cashbackAmount).plus(extra),
        );
      }
    }
  } catch {
    // acelerador best-effort
  }

  const settings = await getBenefitSettings(params.clinicId);
  const dates = computeAvailabilityDates(settings);
  const organizationId = wallet.organizationId ?? organizacaoAtual();

  const giftNote =
    gift && giftUsed.gt(0)
      ? `Vale-presente ${gift.card.code} (${moneyToString(giftUsed, 2)})`
      : null;
  const cartNotes =
    cartItems.length > 1
      ? cartItems
          .map((i) => `${i.quantity}x ${i.name} (${moneyToString(i.unitPrice * i.quantity, 2)})`)
          .join("; ")
      : params.notes;
  const notes = [cartNotes || params.notes, giftNote].filter(Boolean).join(" · ");

  const cashMethod = money(simulation.paidAmount).gt(0)
    ? parsePdvPaymentMethod(params.paymentMethod)
    : "beneficio";
  if (money(simulation.paidAmount).gt(0) && !cashMethod) {
    throw new Error("Informe a forma de pagamento");
  }

  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        organizationId,
        clinicId: params.clinicId,
        unitId: params.unitId ?? null,
        patientId: params.patientId,
        walletId: params.walletId,
        procedureId: primaryProcedureId,
        operatorId: params.operatorId,
        professionalName: params.professionalName,
        status: "CONFIRMED",
        grossAmount: simulation.grossAmount,
        discountAmount: simulation.discountAmount,
        benefitUsed: simulation.benefitUsed,
        paidAmount: simulation.paidAmount,
        cashbackGenerated: simulation.cashbackAmount,
        pointsGenerated: simulation.points,
        idempotencyKey: key,
        notes: notes || null,
        occurredAt: new Date(),
        items:
          cartItems.length > 0
            ? {
                create: cartItems.map((item, index) => ({
                  organizationId,
                  clinicId: params.clinicId,
                  procedureId: item.procedureId,
                  name: item.name,
                  unitPrice: moneyToString(item.unitPrice),
                  quantity: item.quantity,
                  lineTotal: moneyToString(item.unitPrice * item.quantity),
                  professionalName: item.professionalName,
                  sortOrder: index,
                })),
              }
            : undefined,
      },
    });

    if (gift && giftUsed.gt(0)) {
      await redeemGiftCardInTx(tx, {
        clinicId: params.clinicId,
        code: gift.card.code,
        amount: Number(giftUsed),
        actorId: params.operatorId,
        appointmentId: appointment.id,
        patientId: params.patientId,
        walletId: params.walletId,
      });
      await tx.payment.create({
        data: {
          clinicId: params.clinicId,
          appointmentId: appointment.id,
          amount: moneyToString(giftUsed),
          method: "gift_card",
          status: "CONFIRMED",
          confirmedAt: new Date(),
          idempotencyKey: `pay-gift:${key}:${gift.card.code}`,
        },
      });
    }

    if (money(simulation.paidAmount).gt(0) || giftUsed.lte(0)) {
      await tx.payment.create({
        data: {
          clinicId: params.clinicId,
          appointmentId: appointment.id,
          amount: simulation.paidAmount,
          method: cashMethod || "beneficio",
          status: "CONFIRMED",
          confirmedAt: new Date(),
          idempotencyKey: `pay:${key}`,
        },
      });
    }

    return appointment;
  });

  if (money(simulation.benefitUsed).gt(0)) {
    await redeemFromWallet({
      clinicId: params.clinicId,
      walletId: params.walletId,
      patientId: params.patientId,
      amount: simulation.benefitUsed,
      appointmentId: result.id,
      operatorId: params.operatorId,
      unitId: params.unitId,
      reason: "Resgate em atendimento",
      idempotencyKey: `redeem:${key}`,
    });
  }

  if (money(simulation.cashbackAmount).gt(0)) {
    await creditWallet({
      clinicId: params.clinicId,
      walletId: params.walletId,
      patientId: params.patientId,
      amount: simulation.cashbackAmount,
      points: simulation.points + (campaign?.extraPoints ?? 0),
      type: "CREDIT_APPOINTMENT",
      origin: "appointment",
      appointmentId: result.id,
      campaignId: campaign?.id,
      operatorId: params.operatorId,
      unitId: params.unitId,
      availableAt: dates.availableAt,
      expiresAt: dates.expiresAt,
      pending: settings.releaseDays > 0,
      idempotencyKey: `credit:${key}`,
      reason: "Cashback de atendimento",
    });
  } else if (simulation.points > 0 || (campaign?.extraPoints ?? 0) > 0) {
    await prisma.wallet.update({
      where: { id: params.walletId },
      data: {
        pointsBalance: {
          increment: simulation.points + (campaign?.extraPoints ?? 0),
        },
      },
    });
  }

  await prisma.wallet.update({
    where: { id: params.walletId },
    data: {
      annualSpend: { increment: moneyToString(settledAmount) },
      appointmentCount: { increment: 1 },
    },
  });

  await recalculateCategory(params.walletId);

  await writeAuditLog({
    clinicId: params.clinicId,
    unitId: params.unitId,
    userId: params.operatorId,
    action: "CREDIT",
    entityType: "Appointment",
    entityId: result.id,
    afterData: JSON.parse(
      JSON.stringify({ ...simulation, acceleratorIds }),
    ),
  });

  // Side-effects v2 (não bloqueiam a operação financeira)
  try {
    if (acceleratorIds.length) {
      const { markAcceleratorSpend } = await import("@/lib/accelerators");
      await markAcceleratorSpend({
        clinicId: params.clinicId,
        ruleIds: acceleratorIds,
        amount: Number(simulation.cashbackAmount),
      });
    }
    const { markRecoveredOnAppointment } = await import("@/lib/recovery");
    const { convertReferralOnAppointment } = await import("@/lib/referrals");
    const { createSurveyInvite } = await import("@/lib/nps");
    const { runAutomationsForTrigger } = await import("@/lib/automations");
    const { attributeCampaign } = await import("@/lib/metrics");
    const { enqueueWebhook } = await import("@/lib/integrations");
    const { isModuleEnabled } = await import("@/lib/modules");

    await markRecoveredOnAppointment({
      clinicId: params.clinicId,
      patientId: params.patientId,
    });

    await convertReferralOnAppointment({
      clinicId: params.clinicId,
      patientId: params.patientId,
      appointmentId: result.id,
      paidAmount: Number(simulation.paidAmount),
    });

    if (await isModuleEnabled(params.clinicId, "NPS")) {
      await createSurveyInvite({
        clinicId: params.clinicId,
        patientId: params.patientId,
        appointmentId: result.id,
      });
    }

    await runAutomationsForTrigger({
      clinicId: params.clinicId,
      trigger: "PAYMENT_CONFIRMED",
      patientId: params.patientId,
      triggerRef: result.id,
      context: { walletId: params.walletId, unitId: params.unitId },
    });

    if (campaign) {
      await attributeCampaign({
        clinicId: params.clinicId,
        campaignId: campaign.id,
        patientId: params.patientId,
        appointmentId: result.id,
        revenue: Number(simulation.paidAmount),
        benefitCost: Number(simulation.cashbackAmount) + Number(simulation.benefitUsed),
      });
    }

    await enqueueWebhook({
      clinicId: params.clinicId,
      eventType: "appointment.confirmed",
      payload: {
        appointmentId: result.id,
        patientId: params.patientId,
        paidAmount: simulation.paidAmount,
      },
      idempotencyKey: `appointment.confirmed:${result.id}`,
    });
  } catch {
    // side-effects best-effort
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: result.id },
    include: {
      patient: true,
      procedure: true,
      wallet: { include: { category: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  return { appointment, simulation, reused: false };
}

export type SaleCartItemInput = {
  procedureId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  professionalName?: string | null;
};

export async function getAppointmentSale(params: {
  clinicId: string;
  appointmentId: string;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      id: params.appointmentId,
      clinicId: params.clinicId,
      status: "CONFIRMED",
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      procedure: { select: { id: true, name: true, basePrice: true, cashbackPercent: true } },
      patient: { select: { id: true, fullName: true } },
    },
  });
  if (!appointment) throw new Error("Venda não encontrada ou não editável");

  const giftPay = await prisma.payment.findFirst({
    where: {
      appointmentId: appointment.id,
      clinicId: params.clinicId,
      method: "gift_card",
    },
  });
  const giftCardCode = giftCardCodeFromPaymentKey(giftPay?.idempotencyKey);

  const cashPay = await prisma.payment.findFirst({
    where: {
      appointmentId: appointment.id,
      clinicId: params.clinicId,
      method: { not: "gift_card" },
    },
    orderBy: { createdAt: "desc" },
  });

  const items =
    appointment.items.length > 0
      ? appointment.items.map((item) => ({
          procedureId: item.procedureId,
          name: item.name,
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
          lineTotal: Number(item.lineTotal),
          professionalName: item.professionalName,
        }))
      : appointment.procedure
        ? [
            {
              procedureId: appointment.procedure.id,
              name: appointment.procedure.name,
              unitPrice: Number(appointment.grossAmount),
              quantity: 1,
              lineTotal: Number(appointment.grossAmount),
              professionalName: appointment.professionalName,
            },
          ]
        : [];

  return {
    id: appointment.id,
    patientId: appointment.patientId,
    patientName: appointment.patient.fullName,
    walletId: appointment.walletId,
    professionalName: appointment.professionalName,
    discountAmount: Number(appointment.discountAmount),
    benefitUsed: Number(appointment.benefitUsed),
    grossAmount: Number(appointment.grossAmount),
    paidAmount: Number(appointment.paidAmount),
    giftCardCode,
    giftCardAmount: giftPay ? Number(giftPay.amount) : 0,
    paymentMethod:
      cashPay?.method && cashPay.method !== "beneficio"
        ? cashPay.method
        : null,
    items,
  };
}

async function undoAppointmentFinancials(params: {
  clinicId: string;
  appointmentId: string;
  operatorId: string;
  reason: string;
}) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      clinicId: params.clinicId,
      appointmentId: params.appointmentId,
      status: "COMPLETED",
      type: {
        in: [
          "CREDIT_APPOINTMENT",
          "CREDIT_CAMPAIGN",
          "DEBIT_REDEMPTION",
          "CREDIT_ACCELERATOR",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const entry of entries) {
    await reverseLedgerEntry({
      clinicId: params.clinicId,
      entryId: entry.id,
      operatorId: params.operatorId,
      reason: params.reason,
      idempotencyKey: `sale-edit-rev:${params.appointmentId}:${entry.id}`,
    });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, clinicId: params.clinicId },
  });
  if (!appointment) throw new Error("Atendimento não encontrado");

  // Pontos concedidos sem lote de cashback (ramo só-pontos do confirm)
  if (
    appointment.pointsGenerated > 0 &&
    money(appointment.cashbackGenerated).eq(0)
  ) {
    await prisma.wallet.update({
      where: { id: appointment.walletId },
      data: {
        pointsBalance: { decrement: appointment.pointsGenerated },
      },
    });
  }

  const giftPay = await prisma.payment.findFirst({
    where: {
      appointmentId: appointment.id,
      clinicId: params.clinicId,
      method: "gift_card",
    },
  });
  const settledSpend = money(appointment.paidAmount).plus(giftPay?.amount ?? 0);

  await prisma.wallet.update({
    where: { id: appointment.walletId },
    data: {
      annualSpend: {
        decrement: moneyToString(settledSpend),
      },
    },
  });

  await restoreGiftCardForAppointment({
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    actorId: params.operatorId,
  });

  return appointment;
}

export async function updateAppointmentSale(params: {
  clinicId: string;
  unitId?: string | null;
  appointmentId: string;
  operatorId: string;
  professionalName?: string | null;
  discountAmount?: number;
  benefitToUse?: number;
  campaignId?: string | null;
  giftCardCode?: string | null;
  giftCardAmount?: number | null;
  paymentMethod?: string | null;
  items: SaleCartItemInput[];
}) {
  const existing = await prisma.appointment.findFirst({
    where: {
      id: params.appointmentId,
      clinicId: params.clinicId,
      status: "CONFIRMED",
    },
  });
  if (!existing) throw new Error("Venda não encontrada ou não editável");

  const cartItems = params.items
    .map((item) => ({
      procedureId: item.procedureId || null,
      name: item.name.trim(),
      unitPrice: Number(item.unitPrice),
      quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      professionalName: item.professionalName || params.professionalName || null,
    }))
    .filter((item) => item.name && item.unitPrice >= 0);

  if (cartItems.length === 0) {
    throw new Error("A venda precisa de ao menos um serviço");
  }

  await undoAppointmentFinancials({
    clinicId: params.clinicId,
    appointmentId: existing.id,
    operatorId: params.operatorId,
    reason: `Edição de venda ${existing.id}`,
  });

  const wallet = await prisma.wallet.findFirst({
    where: {
      id: existing.walletId,
      clinicId: params.clinicId,
      status: "ACTIVE",
    },
    include: { category: true },
  });
  if (!wallet) throw new Error("Carteira inválida");

  const procedureIds = [
    ...new Set(
      cartItems
        .map((i) => i.procedureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const procedures = procedureIds.length
    ? await prisma.procedure.findMany({
        where: { clinicId: params.clinicId, id: { in: procedureIds } },
      })
    : [];
  const procedureById = Object.fromEntries(procedures.map((p) => [p.id, p]));

  let procedureCashbackPercent: number | null = null;
  let weight = 0;
  let total = 0;
  for (const item of cartItems) {
    const line = item.unitPrice * item.quantity;
    total += line;
    const pct = item.procedureId
      ? procedureById[item.procedureId]?.cashbackPercent
      : null;
    if (pct != null) weight += line * Number(pct);
  }
  if (total > 0 && weight > 0) procedureCashbackPercent = weight / total;

  const campaign = params.campaignId
    ? await prisma.campaign.findFirst({
        where: {
          id: params.campaignId,
          clinicId: params.clinicId,
          status: "ACTIVE",
        },
      })
    : null;

  const baseSimulation = await simulateBenefit({
    clinicId: params.clinicId,
    categoryCashbackPercent: wallet.category
      ? Number(wallet.category.cashbackPercent)
      : null,
    procedureCashbackPercent,
    campaignExtraPercent: campaign ? Number(campaign.extraCashbackPct) : null,
    grossAmount: total,
    discountAmount: params.discountAmount ?? 0,
    benefitToUse: params.benefitToUse ?? 0,
    availableBalance: Number(wallet.availableBalance),
  });

  const { simulation: withGift, gift } = await applyOptionalGiftCard({
    clinicId: params.clinicId,
    simulation: baseSimulation,
    giftCardCode: params.giftCardCode,
    giftCardAmount: params.giftCardAmount,
  });
  const simulation = { ...withGift };
  const settledAmount = money(baseSimulation.paidAmount);
  const giftUsed = money(withGift.giftCardAmount ?? 0);
  const primaryProcedureId = cartItems.find((i) => i.procedureId)?.procedureId ?? null;
  const organizationId = wallet.organizationId ?? organizacaoAtual();
  const settings = await getBenefitSettings(params.clinicId);
  const dates = computeAvailabilityDates(settings);
  const giftNote =
    gift && giftUsed.gt(0)
      ? `Vale-presente ${gift.card.code} (${moneyToString(giftUsed, 2)})`
      : null;
  const cartNotes = [
    cartItems
      .map(
        (i) =>
          `${i.quantity}x ${i.name} (${moneyToString(i.unitPrice * i.quantity, 2)})`,
      )
      .join("; "),
    giftNote,
  ]
    .filter(Boolean)
    .join(" · ");

  const cashMethod = money(simulation.paidAmount).gt(0)
    ? parsePdvPaymentMethod(params.paymentMethod)
    : "beneficio";
  if (money(simulation.paidAmount).gt(0) && !cashMethod) {
    throw new Error("Informe a forma de pagamento");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.appointmentItem.deleteMany({
      where: { appointmentId: existing.id },
    });

    const appointment = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        procedureId: primaryProcedureId,
        professionalName: params.professionalName || null,
        grossAmount: simulation.grossAmount,
        discountAmount: simulation.discountAmount,
        benefitUsed: simulation.benefitUsed,
        paidAmount: simulation.paidAmount,
        cashbackGenerated: simulation.cashbackAmount,
        pointsGenerated: simulation.points,
        notes: cartNotes,
        items: {
          create: cartItems.map((item, index) => ({
            organizationId,
            clinicId: params.clinicId,
            procedureId: item.procedureId,
            name: item.name,
            unitPrice: moneyToString(item.unitPrice),
            quantity: item.quantity,
            lineTotal: moneyToString(item.unitPrice * item.quantity),
            professionalName: item.professionalName,
            sortOrder: index,
          })),
        },
      },
      include: {
        items: true,
        procedure: true,
      },
    });

    await tx.payment.deleteMany({
      where: { appointmentId: existing.id, clinicId: params.clinicId },
    });

    if (gift && giftUsed.gt(0)) {
      await redeemGiftCardInTx(tx, {
        clinicId: params.clinicId,
        code: gift.card.code,
        amount: Number(giftUsed),
        actorId: params.operatorId,
        appointmentId: existing.id,
        patientId: existing.patientId,
        walletId: existing.walletId,
      });
      await tx.payment.create({
        data: {
          clinicId: params.clinicId,
          appointmentId: existing.id,
          amount: moneyToString(giftUsed),
          method: "gift_card",
          status: "CONFIRMED",
          confirmedAt: new Date(),
          idempotencyKey: `pay-gift:${existing.id}:${gift.card.code}`,
        },
      });
    }

    if (money(simulation.paidAmount).gt(0) || giftUsed.lte(0)) {
      await tx.payment.create({
        data: {
          clinicId: params.clinicId,
          appointmentId: existing.id,
          amount: simulation.paidAmount,
          method: cashMethod || "beneficio",
          status: "CONFIRMED",
          confirmedAt: new Date(),
          idempotencyKey: `pay:${existing.id}:${Date.now()}`,
        },
      });
    }

    return appointment;
  });

  const editKey = `sale-edit:${existing.id}:${Date.now()}`;

  if (money(simulation.benefitUsed).gt(0)) {
    await redeemFromWallet({
      clinicId: params.clinicId,
      walletId: existing.walletId,
      patientId: existing.patientId,
      amount: simulation.benefitUsed,
      appointmentId: existing.id,
      operatorId: params.operatorId,
      unitId: params.unitId ?? existing.unitId,
      reason: "Resgate em atendimento (edição)",
      idempotencyKey: `redeem:${editKey}`,
    });
  }

  if (money(simulation.cashbackAmount).gt(0)) {
    await creditWallet({
      clinicId: params.clinicId,
      walletId: existing.walletId,
      patientId: existing.patientId,
      amount: simulation.cashbackAmount,
      points: simulation.points + (campaign?.extraPoints ?? 0),
      type: "CREDIT_APPOINTMENT",
      origin: "appointment-edit",
      appointmentId: existing.id,
      campaignId: campaign?.id,
      operatorId: params.operatorId,
      unitId: params.unitId ?? existing.unitId,
      availableAt: dates.availableAt,
      expiresAt: dates.expiresAt,
      pending: settings.releaseDays > 0,
      idempotencyKey: `credit:${editKey}`,
      reason: "Cashback de atendimento (edição)",
    });
  } else if (simulation.points > 0 || (campaign?.extraPoints ?? 0) > 0) {
    await prisma.wallet.update({
      where: { id: existing.walletId },
      data: {
        pointsBalance: {
          increment: simulation.points + (campaign?.extraPoints ?? 0),
        },
      },
    });
  }

  await prisma.wallet.update({
    where: { id: existing.walletId },
    data: {
      annualSpend: { increment: moneyToString(settledAmount) },
    },
  });

  await recalculateCategory(existing.walletId);

  await writeAuditLog({
    clinicId: params.clinicId,
    unitId: params.unitId ?? existing.unitId,
    userId: params.operatorId,
    action: "ADJUSTMENT",
    entityType: "Appointment",
    entityId: existing.id,
    beforeData: {
      grossAmount: Number(existing.grossAmount),
      paidAmount: Number(existing.paidAmount),
      benefitUsed: Number(existing.benefitUsed),
    },
    afterData: JSON.parse(JSON.stringify(simulation)),
    metadata: { kind: "sale.update" },
  });

  return { appointment: updated, simulation };
}
