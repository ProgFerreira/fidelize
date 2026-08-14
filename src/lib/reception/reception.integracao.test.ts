import { randomUUID } from "crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { confirmAppointment, updateAppointmentSale } from "@/lib/reception";
import { creditWallet } from "@/lib/ledger";
import { simulateBenefit } from "@/lib/cashback";
import { isModuleEnabled } from "@/lib/modules";

const runDb = process.env.RUN_DB_TESTS === "1";

function makeCpf(seed: number) {
  const base = String(200000000 + seed)
    .padStart(9, "0")
    .slice(0, 9)
    .split("")
    .map(Number);
  let sum = base.reduce((a, d, i) => a + d * (10 - i), 0);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  const n = [...base, d1];
  sum = n.reduce((a, d, i) => a + d * (11 - i), 0);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return [...n, d2].join("");
}

describe.runIf(runDb)("PDV confirmAppointment transação única", () => {
  let clinicId = "";
  let organizationId = "";
  let operatorId = "";
  const patientIds: string[] = [];
  const campaignIds: string[] = [];
  const giftCardIds: string[] = [];
  let giftEnabled = false;

  const teste = (nome: string, fn: () => Promise<void>) =>
    it(nome, () => comOrganizacao({ organizationId }, fn));

  async function criarPaciente(nome: string) {
    const patient = await prisma.patient.create({
      data: {
        clinicId,
        fullName: nome,
        cpf: makeCpf(Math.floor(Math.random() * 80000) + 1000),
        phone: `119${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
        regulationConsent: true,
        status: "ACTIVE",
      },
    });
    const wallet = await prisma.wallet.create({
      data: {
        clinicId,
        patientId: patient.id,
        status: "ACTIVE",
        availableBalance: 0,
        pendingBalance: 0,
        pointsBalance: 0,
      },
    });
    patientIds.push(patient.id);
    return { patient, wallet };
  }

  beforeAll(async () => {
    const clinic = await semOrganizacao(() =>
      prisma.clinic.findFirst({ where: { active: true } }),
    );
    if (!clinic?.organizationId) {
      throw new Error("Seed necessário antes dos testes de DB");
    }
    clinicId = clinic.id;
    organizationId = clinic.organizationId;
    const admin = await semOrganizacao(() =>
      prisma.user.findFirst({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      }),
    );
    if (!admin) throw new Error("Nenhum usuário ativo para operatorId");
    operatorId = admin.id;
    giftEnabled = await comOrganizacao({ organizationId }, () =>
      isModuleEnabled(clinicId, "GIFT_CARD"),
    );
  });

  afterAll(async () => {
    if (!organizationId) return;
    await comOrganizacao({ organizationId }, async () => {
      if (patientIds.length === 0 && campaignIds.length === 0) return;
      const wallets = patientIds.length
        ? await prisma.wallet.findMany({
            where: { patientId: { in: patientIds } },
            select: { id: true },
          })
        : [];
      const walletIds = wallets.map((w) => w.id);
      const appointments = patientIds.length
        ? await prisma.appointment.findMany({
            where: { patientId: { in: patientIds } },
            select: { id: true },
          })
        : [];
      const appointmentIds = appointments.map((a) => a.id);

      if (appointmentIds.length) {
        const redemptions = await prisma.redemption.findMany({
          where: { appointmentId: { in: appointmentIds } },
          select: { id: true },
        });
        const redemptionIds = redemptions.map((r) => r.id);
        if (redemptionIds.length) {
          await prisma.redemptionItem.deleteMany({
            where: { redemptionId: { in: redemptionIds } },
          });
          await prisma.redemption.deleteMany({
            where: { id: { in: redemptionIds } },
          });
        }
        await prisma.payment.deleteMany({
          where: { appointmentId: { in: appointmentIds } },
        });
        await prisma.appointmentItem.deleteMany({
          where: { appointmentId: { in: appointmentIds } },
        });
        await prisma.surveyResponse
          .deleteMany({ where: { appointmentId: { in: appointmentIds } } })
          .catch(() => undefined);
        await prisma.campaignAttribution
          .deleteMany({ where: { appointmentId: { in: appointmentIds } } })
          .catch(() => undefined);
        await prisma.auditLog
          .deleteMany({
            where: { entityType: "Appointment", entityId: { in: appointmentIds } },
          })
          .catch(() => undefined);
      }

      if (patientIds.length) {
        await prisma.ledgerEntry.deleteMany({
          where: { patientId: { in: patientIds } },
        });
        await prisma.campaignUse.deleteMany({
          where: { patientId: { in: patientIds } },
        });
      }
      if (walletIds.length) {
        await prisma.creditLot.deleteMany({
          where: { walletId: { in: walletIds } },
        });
      }
      if (appointmentIds.length) {
        await prisma.appointment.deleteMany({
          where: { id: { in: appointmentIds } },
        });
      }
      if (giftCardIds.length) {
        await prisma.giftCardTransaction.deleteMany({
          where: { giftCardId: { in: giftCardIds } },
        });
        await prisma.giftCard.deleteMany({ where: { id: { in: giftCardIds } } });
      }
      if (campaignIds.length) {
        await prisma.campaignUse.deleteMany({
          where: { campaignId: { in: campaignIds } },
        });
        await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
      }
      if (patientIds.length) {
        await prisma.wallet.deleteMany({
          where: { patientId: { in: patientIds } },
        });
        await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
      }
    });
  });

  teste("desfaz atendimento e pagamento se o resgate falhar no meio da transação", async () => {
    const { patient, wallet } = await criarPaciente("PDV Rollback Teste");
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { availableBalance: "50.0000" },
    });

    const key = `pdv-rollback-${randomUUID()}`;
    await expect(
      confirmAppointment({
        clinicId,
        patientId: patient.id,
        walletId: wallet.id,
        operatorId,
        grossAmount: 100,
        benefitToUse: 50,
        paymentMethod: "pix",
        idempotencyKey: key,
        items: [{ name: "Consulta rollback", unitPrice: 100, quantity: 1 }],
      }),
    ).rejects.toThrow(/lotes de crédito|Saldo insuficiente/i);

    const appointment = await prisma.appointment.findFirst({
      where: { clinicId, idempotencyKey: key },
    });
    expect(appointment).toBeNull();

    const payments = await prisma.payment.findMany({
      where: { clinicId, idempotencyKey: `pay:${key}` },
    });
    expect(payments).toHaveLength(0);

    const ledger = await prisma.ledgerEntry.findMany({
      where: { patientId: patient.id },
    });
    expect(ledger).toHaveLength(0);
  });

  teste("grava venda, pagamento, resgate, cashback, pontos e campanha juntos", async () => {
    const { patient, wallet } = await criarPaciente("PDV Venda Completa");

    await creditWallet({
      clinicId,
      walletId: wallet.id,
      patientId: patient.id,
      amount: 30,
      points: 0,
      origin: "pdv-setup",
      availableAt: new Date(),
      idempotencyKey: `pdv-setup-${wallet.id}`,
    });

    const campaign = await prisma.campaign.create({
      data: {
        clinicId,
        name: "Campanha PDV teste",
        status: "ACTIVE",
        extraCashbackPct: "5",
        extraPoints: 3,
        totalLimit: 10,
        perPatientLimit: 2,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });
    campaignIds.push(campaign.id);

    let giftCode: string | undefined;
    if (giftEnabled) {
      const card = await prisma.giftCard.create({
        data: {
          clinicId,
          code: `GPPDV${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`,
          initialAmount: "40.0000",
          remainingAmount: "40.0000",
          status: "ACTIVE",
          allowPartial: true,
        },
      });
      giftCardIds.push(card.id);
      giftCode = card.code;
    }

    const key = `pdv-ok-${randomUUID()}`;
    const result = await confirmAppointment({
      clinicId,
      patientId: patient.id,
      walletId: wallet.id,
      operatorId,
      professionalName: "Dr. Teste",
      grossAmount: 200,
      discountAmount: 0,
      benefitToUse: 30,
      campaignId: campaign.id,
      paymentMethod: "pix",
      giftCardCode: giftCode,
      idempotencyKey: key,
      items: [
        {
          name: "Limpeza de pele",
          unitPrice: 200,
          quantity: 1,
        },
      ],
    });

    expect(result.reused).toBeFalsy();
    if (!result.appointment) throw new Error("venda não criada");
    expect(result.appointment.status).toBe("CONFIRMED");
    expect(Number(result.appointment.grossAmount)).toBe(200);
    expect(Number(result.appointment.benefitUsed)).toBe(30);
    expect(result.appointment.id).toBeTruthy();

    const replay = await confirmAppointment({
      clinicId,
      patientId: patient.id,
      walletId: wallet.id,
      operatorId,
      grossAmount: 200,
      benefitToUse: 30,
      campaignId: campaign.id,
      paymentMethod: "pix",
      giftCardCode: giftCode,
      idempotencyKey: key,
      items: [{ name: "Limpeza de pele", unitPrice: 200, quantity: 1 }],
    });
    expect(replay.reused).toBe(true);
    if (!replay.appointment) throw new Error("replay sem venda");
    expect(replay.appointment.id).toBe(result.appointment.id);

    const [payments, ledger, uses, items, walletAfter] = await Promise.all([
      prisma.payment.findMany({
        where: { appointmentId: result.appointment.id },
      }),
      prisma.ledgerEntry.findMany({
        where: { appointmentId: result.appointment.id },
      }),
      prisma.campaignUse.findMany({
        where: { campaignId: campaign.id, patientId: patient.id },
      }),
      prisma.appointmentItem.findMany({
        where: { appointmentId: result.appointment.id },
      }),
      prisma.wallet.findUnique({ where: { id: wallet.id } }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Limpeza de pele");

    const pix = payments.find((p) => p.method === "pix");
    expect(pix).toBeTruthy();
    expect(pix?.status).toBe("CONFIRMED");
    expect(Number(pix?.amount)).toBe(Number(result.appointment.paidAmount));

    const debit = ledger.find((e) => e.type === "DEBIT_REDEMPTION");
    const credit = ledger.find((e) => e.type === "CREDIT_APPOINTMENT");
    expect(debit).toBeTruthy();
    expect(credit).toBeTruthy();
    expect(Number(debit?.amount)).toBe(30);
    expect(Number(credit?.amount)).toBe(
      Number(result.appointment.cashbackGenerated),
    );
    expect(credit?.points).toBe(
      result.appointment.pointsGenerated + campaign.extraPoints,
    );
    expect(credit?.status).toBe("COMPLETED");

    expect(uses).toHaveLength(1);
    expect(walletAfter?.appointmentCount).toBe(1);
    expect(walletAfter?.pointsBalance).toBe(credit?.points);
    if (credit?.status === "PENDING") {
      expect(Number(walletAfter?.availableBalance)).toBe(0);
      expect(Number(walletAfter?.pendingBalance)).toBe(
        Number(result.appointment.cashbackGenerated),
      );
    } else {
      expect(Number(walletAfter?.availableBalance)).toBeCloseTo(
        Number(result.appointment.cashbackGenerated),
        4,
      );
    }

    if (giftCode) {
      const giftPay = payments.find((p) => p.method === "gift_card");
      expect(giftPay).toBeTruthy();
      expect(Number(giftPay?.amount)).toBe(40);
      const card = await prisma.giftCard.findFirst({
        where: { clinicId, code: giftCode },
      });
      expect(Number(card?.remainingAmount)).toBe(0);
      expect(card?.status).toBe("USED");
    }

    const expectedPaid = giftCode ? 130 : 170;
    expect(Number(result.appointment.paidAmount)).toBe(expectedPaid);

    const sim = await simulateBenefit({
      clinicId,
      patientId: patient.id,
      excludeAppointmentId: result.appointment.id,
      campaignExtraPercent: Number(campaign.extraCashbackPct),
      grossAmount: 200,
      benefitToUse: 30,
      availableBalance: 30,
    });
    if (!giftCode) {
      expect(result.appointment.cashbackGenerated).toBe(sim.cashbackAmount);
      expect(result.appointment.pointsGenerated).toBe(sim.points);
    }
  });

  teste("reedição desfaz estorno se a nova gravação falhar", async () => {
    const { patient, wallet } = await criarPaciente("PDV Edição Rollback");
    const confirmed = await confirmAppointment({
      clinicId,
      patientId: patient.id,
      walletId: wallet.id,
      operatorId,
      grossAmount: 120,
      paymentMethod: "pix",
      items: [{ name: "Consulta edição", unitPrice: 120, quantity: 1 }],
    });
    if (!confirmed.appointment) throw new Error("venda não criada");
    const saleId = confirmed.appointment.id;

    const before = await Promise.all([
      prisma.appointment.findUnique({ where: { id: saleId } }),
      prisma.payment.findMany({
        where: { appointmentId: saleId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.ledgerEntry.findMany({
        where: { appointmentId: saleId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.wallet.findUnique({ where: { id: wallet.id } }),
    ]);
    const [appointmentBefore, paymentsBefore, ledgerBefore, walletBefore] =
      before;

    await expect(
      updateAppointmentSale({
        clinicId,
        appointmentId: saleId,
        operatorId,
        paymentMethod: null,
        items: [{ name: "Consulta edição", unitPrice: 180, quantity: 1 }],
      }),
    ).rejects.toThrow(/forma de pagamento/i);

    const [appointmentAfter, paymentsAfter, ledgerAfter, walletAfter] =
      await Promise.all([
        prisma.appointment.findUnique({
          where: { id: saleId },
        }),
        prisma.payment.findMany({
          where: { appointmentId: saleId },
          orderBy: { createdAt: "asc" },
        }),
        prisma.ledgerEntry.findMany({
          where: { appointmentId: saleId },
          orderBy: { createdAt: "asc" },
        }),
        prisma.wallet.findUnique({ where: { id: wallet.id } }),
      ]);

    expect(Number(appointmentAfter?.grossAmount)).toBe(
      Number(appointmentBefore?.grossAmount),
    );
    expect(Number(appointmentAfter?.paidAmount)).toBe(
      Number(appointmentBefore?.paidAmount),
    );
    expect(appointmentAfter?.status).toBe("CONFIRMED");
    expect(paymentsAfter.map((p) => [p.method, p.status, String(p.amount)]))
      .toEqual(
        paymentsBefore.map((p) => [p.method, p.status, String(p.amount)]),
      );
    expect(ledgerAfter.map((e) => [e.id, e.type, e.status])).toEqual(
      ledgerBefore.map((e) => [e.id, e.type, e.status]),
    );
    expect(ledgerAfter.some((e) => e.type.startsWith("REVERSAL_"))).toBe(false);
    expect(String(walletAfter?.availableBalance)).toBe(
      String(walletBefore?.availableBalance),
    );
    expect(walletAfter?.pointsBalance).toBe(walletBefore?.pointsBalance);
  });

  teste("reedição estorna e regrava venda, pagamento e ledger juntos", async () => {
    const { patient, wallet } = await criarPaciente("PDV Edição Completa");
    const confirmed = await confirmAppointment({
      clinicId,
      patientId: patient.id,
      walletId: wallet.id,
      operatorId,
      grossAmount: 200,
      paymentMethod: "pix",
      items: [{ name: "Limpeza edição", unitPrice: 200, quantity: 1 }],
    });
    if (!confirmed.appointment) throw new Error("venda não criada");
    const saleId = confirmed.appointment.id;

    const edited = await updateAppointmentSale({
      clinicId,
      appointmentId: saleId,
      operatorId,
      paymentMethod: "dinheiro",
      items: [{ name: "Limpeza edição", unitPrice: 150, quantity: 1 }],
    });

    expect(Number(edited.appointment.grossAmount)).toBe(150);
    expect(edited.appointment.id).toBe(saleId);

    const [payments, ledger, items] = await Promise.all([
      prisma.payment.findMany({
        where: { appointmentId: saleId },
      }),
      prisma.ledgerEntry.findMany({
        where: { appointmentId: saleId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.appointmentItem.findMany({
        where: { appointmentId: saleId },
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(Number(items[0]?.unitPrice)).toBe(150);

    const cash = payments.find((p) => p.method !== "gift_card");
    expect(cash?.method).toBe("dinheiro");
    expect(cash?.status).toBe("CONFIRMED");
    expect(Number(cash?.amount)).toBe(Number(edited.appointment.paidAmount));

    const originalCredit = ledger.find(
      (e) =>
        e.type === "CREDIT_APPOINTMENT" &&
        e.status === "REVERSED",
    );
    const newCredit = ledger.find(
      (e) =>
        e.type === "CREDIT_APPOINTMENT" &&
        e.status === "COMPLETED",
    );
    const reversal = ledger.find((e) => e.type === "REVERSAL_CREDIT");
    expect(originalCredit).toBeTruthy();
    expect(newCredit).toBeTruthy();
    expect(reversal).toBeTruthy();
    expect(Number(newCredit?.amount)).toBe(
      Number(edited.appointment.cashbackGenerated),
    );
  });
});
