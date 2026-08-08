import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import {
  simulateBenefit,
  computeAvailabilityDates,
  getBenefitSettings,
} from "@/lib/cashback";
import { creditWallet, redeemFromWallet } from "@/lib/ledger";
import { recalculateCategory } from "@/lib/categories";
import { writeAuditLog } from "@/lib/audit";
import { money, moneyToString } from "@/lib/money";

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

  const procedure = params.procedureId
    ? await prisma.procedure.findFirst({
        where: { id: params.procedureId, clinicId: params.clinicId },
      })
    : null;

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
    procedureCashbackPercent: procedure?.cashbackPercent
      ? Number(procedure.cashbackPercent)
      : null,
    campaignExtraPercent: campaign ? Number(campaign.extraCashbackPct) : null,
    grossAmount: params.grossAmount,
    discountAmount: params.discountAmount ?? 0,
    benefitToUse: params.benefitToUse ?? 0,
    availableBalance: Number(wallet.availableBalance),
  });

  const simulation = { ...baseSimulation };
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
        procedureId: params.procedureId,
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

  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        clinicId: params.clinicId,
        unitId: params.unitId ?? null,
        patientId: params.patientId,
        walletId: params.walletId,
        procedureId: params.procedureId ?? null,
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
        notes: params.notes,
        occurredAt: new Date(),
      },
    });

    await tx.payment.create({
      data: {
        clinicId: params.clinicId,
        appointmentId: appointment.id,
        amount: simulation.paidAmount,
        method: "manual",
        status: "CONFIRMED",
        confirmedAt: new Date(),
        idempotencyKey: `pay:${key}`,
      },
    });

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
      annualSpend: { increment: moneyToString(simulation.paidAmount) },
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
    },
  });

  return { appointment, simulation, reused: false };
}
