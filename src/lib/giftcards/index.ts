import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma, type TransacaoPrisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { money, moneyToString } from "@/lib/money";
import {
  giftCardCodeFromPaymentKey,
  normalizeGiftCardCode,
  quoteGiftCardUse,
} from "@/lib/giftcards/quote";

export { giftCardCodeFromPaymentKey, normalizeGiftCardCode, quoteGiftCardUse };

export const giftCardSchema = z.object({
  initialAmount: z.coerce.number().positive(),
  buyerName: z.string().max(120).optional().nullable(),
  beneficiaryName: z.string().max(120).optional().nullable(),
  buyerPatientId: z.string().optional().nullable(),
  beneficiaryPatientId: z.string().optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  allowPartial: z.boolean().default(true),
  expiresAt: z.coerce.date().optional().nullable(),
  sendAt: z.coerce.date().optional().nullable(),
});

export async function issueGiftCard(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof giftCardSchema>;
  activate?: boolean;
}) {
  await requireModule(input.clinicId, "GIFT_CARD");
  const data = giftCardSchema.parse(input.data);
  const amount = money(data.initialAmount).toFixed(4);

  const card = await prisma.giftCard.create({
    data: {
      clinicId: input.clinicId,
      code: `GP${randomBytes(5).toString("hex").toUpperCase()}`,
      initialAmount: amount,
      remainingAmount: amount,
      buyerName: data.buyerName ?? null,
      beneficiaryName: data.beneficiaryName ?? null,
      buyerPatientId: data.buyerPatientId ?? null,
      beneficiaryPatientId: data.beneficiaryPatientId ?? null,
      message: data.message ?? null,
      allowPartial: data.allowPartial,
      expiresAt: data.expiresAt ?? null,
      sendAt: data.sendAt ?? null,
      status: input.activate ? "ACTIVE" : "PENDING_PAYMENT",
      transactions: {
        create: {
          type: "ISSUE",
          amount,
          actorId: input.actorId,
          notes: "Emissão de vale-presente",
        },
      },
    },
    include: { transactions: true },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "GIFT_CARD",
    entityType: "GiftCard",
    entityId: card.id,
    afterData: { code: card.code, amount },
  });

  return card;
}

export async function activateGiftCard(input: {
  clinicId: string;
  giftCardId: string;
  actorId?: string;
}) {
  const existing = await prisma.giftCard.findFirst({
    where: { id: input.giftCardId, clinicId: input.clinicId },
  });
  if (!existing) throw new Error("Vale inválido");
  const card = await prisma.giftCard.update({
    where: { id: existing.id },
    data: { status: "ACTIVE" },
  });
  await prisma.giftCardTransaction.create({
    data: {
      giftCardId: card.id,
      type: "ACTIVATE",
      amount: "0",
      actorId: input.actorId,
    },
  });
  return card;
}

export type GiftCardLookup = {
  id: string;
  code: string;
  remainingAmount: string;
  initialAmount: string;
  allowPartial: boolean;
  status: string;
  expiresAt: Date | null;
  beneficiaryName: string | null;
  buyerName: string | null;
};

function assertGiftCardUsable(card: {
  status: string;
  expiresAt: Date | null;
  remainingAmount: Parameters<typeof money>[0];
}) {
  if (card.status === "CANCELLED" || card.status === "EXPIRED") {
    throw new Error("Vale-presente inválido");
  }
  if (card.status === "PENDING_PAYMENT") {
    throw new Error("Vale ainda não ativado");
  }
  if (card.status === "USED" || money(card.remainingAmount).lte(0)) {
    throw new Error("Vale já utilizado");
  }
  if (card.expiresAt && card.expiresAt < new Date()) {
    throw new Error("Vale expirado");
  }
}

export async function lookupGiftCard(input: {
  clinicId: string;
  code: string;
  creditBackAppointmentId?: string | null;
  db?: TransacaoPrisma;
}): Promise<GiftCardLookup> {
  await requireModule(input.clinicId, "GIFT_CARD");
  const db = input.db ?? prisma;
  const code = normalizeGiftCardCode(input.code);
  if (!code) throw new Error("Informe o código do vale");
  const card = await db.giftCard.findFirst({
    where: { clinicId: input.clinicId, code },
  });
  if (!card) throw new Error("Vale-presente inválido");

  let remaining = money(card.remainingAmount);
  let status = card.status;
  if (input.creditBackAppointmentId) {
    const pay = await db.payment.findFirst({
      where: {
        appointmentId: input.creditBackAppointmentId,
        clinicId: input.clinicId,
        method: "gift_card",
      },
    });
    const existingCode = giftCardCodeFromPaymentKey(pay?.idempotencyKey);
    if (
      pay &&
      existingCode &&
      normalizeGiftCardCode(existingCode) === code
    ) {
      remaining = remaining.plus(pay.amount);
      if (status === "USED" && remaining.gt(0)) {
        status = remaining.lt(money(card.initialAmount))
          ? "PARTIALLY_USED"
          : "ACTIVE";
      }
    }
  }

  assertGiftCardUsable({
    ...card,
    remainingAmount: remaining,
    status,
  });
  return {
    id: card.id,
    code: card.code,
    remainingAmount: moneyToString(remaining),
    initialAmount: moneyToString(card.initialAmount),
    allowPartial: card.allowPartial,
    status,
    expiresAt: card.expiresAt,
    beneficiaryName: card.beneficiaryName,
    buyerName: card.buyerName,
  };
}

export async function quoteGiftCardForSale(input: {
  clinicId: string;
  code: string;
  amountDue: number;
  requestedAmount?: number | null;
  creditBackAppointmentId?: string | null;
  db?: TransacaoPrisma;
}) {
  const card = await lookupGiftCard({
    clinicId: input.clinicId,
    code: input.code,
    creditBackAppointmentId: input.creditBackAppointmentId,
    db: input.db,
  });
  const quote = quoteGiftCardUse({
    remainingAmount: card.remainingAmount,
    amountDue: input.amountDue,
    requestedAmount: input.requestedAmount,
    allowPartial: card.allowPartial,
  });
  return { card, ...quote };
}

type RedeemInput = {
  clinicId: string;
  code: string;
  amount: number;
  actorId?: string;
  appointmentId?: string;
  patientId?: string;
  walletId?: string;
};

async function redeemGiftCardInTx(tx: TransacaoPrisma, input: RedeemInput) {
  const code = normalizeGiftCardCode(input.code);
  const card = await tx.giftCard.findFirst({
    where: { clinicId: input.clinicId, code },
  });
  if (!card) throw new Error("Vale-presente inválido");
  assertGiftCardUsable(card);

  const remaining = money(card.remainingAmount);
  const use = money(input.amount);
  if (use.lte(0)) throw new Error("Valor inválido");
  if (use.gt(remaining)) throw new Error("Saldo insuficiente no vale");
  if (!card.allowPartial && !use.eq(remaining)) {
    throw new Error("Este vale não permite uso parcial");
  }

  const next = remaining.minus(use);
  const updated = await tx.giftCard.update({
    where: { id: card.id },
    data: {
      remainingAmount: next.toFixed(4),
      status: next.lte(0) ? "USED" : "PARTIALLY_USED",
    },
  });

  await tx.giftCardTransaction.create({
    data: {
      giftCardId: card.id,
      type: "REDEEM",
      amount: use.toFixed(4),
      actorId: input.actorId,
      notes: input.appointmentId
        ? `appointment:${input.appointmentId}`
        : "Uso de vale-presente",
    },
  });

  const patientId =
    input.patientId ?? card.beneficiaryPatientId ?? card.buyerPatientId;
  if (patientId) {
    const wallet = input.walletId
      ? await tx.wallet.findFirst({
          where: {
            id: input.walletId,
            clinicId: input.clinicId,
            patientId,
          },
        })
      : await tx.wallet.findFirst({
          where: { clinicId: input.clinicId, patientId },
        });
    if (wallet) {
      await tx.ledgerEntry.create({
        data: {
          clinicId: input.clinicId,
          patientId,
          walletId: wallet.id,
          type: "GIFT_CARD_REDEEM",
          status: "COMPLETED",
          amount: use.toFixed(4),
          points: 0,
          balanceBefore: remaining.toFixed(4),
          balanceAfter: next.toFixed(4),
          origin: "gift_card",
          appointmentId: input.appointmentId ?? null,
          reason: `Uso vale-presente ${card.code}`,
          metadata: {
            giftCardId: card.id,
            code: card.code,
            appointmentId: input.appointmentId ?? null,
          },
          operatorId: input.actorId,
          idempotencyKey: input.appointmentId
            ? `gift-redeem:${input.appointmentId}:${card.id}`
            : `gift-redeem:${card.id}:${use.toFixed(4)}:${remaining.toFixed(4)}`,
        },
      });
    }
  }

  return updated;
}

export async function redeemGiftCard(input: RedeemInput) {
  await requireModule(input.clinicId, "GIFT_CARD");
  const card = await prisma.$transaction((tx) =>
    redeemGiftCardInTx(tx, input),
  );
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "GIFT_CARD",
    entityType: "GiftCard",
    entityId: card.id,
    afterData: { remaining: String(card.remainingAmount), status: card.status },
  });
  return card;
}

export { redeemGiftCardInTx };

export async function restoreGiftCardForAppointment(input: {
  clinicId: string;
  appointmentId: string;
  actorId?: string;
  db?: TransacaoPrisma;
}) {
  const db = input.db ?? prisma;
  const txs = await db.giftCardTransaction.findMany({
    where: {
      type: "REDEEM",
      notes: `appointment:${input.appointmentId}`,
      giftCard: { clinicId: input.clinicId },
    },
    include: { giftCard: true },
  });
  if (txs.length === 0) return;

  for (const row of txs) {
    const card = row.giftCard;
    const restored = money(card.remainingAmount).plus(row.amount);
    const initial = money(card.initialAmount);
    const nextRemaining = restored.gt(initial) ? initial : restored;
    const status = nextRemaining.lte(0)
      ? "USED"
      : nextRemaining.eq(initial)
        ? "ACTIVE"
        : "PARTIALLY_USED";
    await db.giftCard.update({
      where: { id: card.id },
      data: {
        remainingAmount: nextRemaining.toFixed(4),
        status,
      },
    });
    await db.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        type: "RESTORE",
        amount: moneyToString(row.amount),
        actorId: input.actorId,
        notes: `appointment:${input.appointmentId}`,
      },
    });
  }

  await db.ledgerEntry.updateMany({
    where: {
      clinicId: input.clinicId,
      appointmentId: input.appointmentId,
      type: "GIFT_CARD_REDEEM",
      status: "COMPLETED",
    },
    data: { status: "REVERSED" },
  });

  const reversed = await db.ledgerEntry.findMany({
    where: {
      clinicId: input.clinicId,
      appointmentId: input.appointmentId,
      type: "GIFT_CARD_REDEEM",
      status: "REVERSED",
    },
    select: { id: true },
  });
  for (const entry of reversed) {
    await db.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        idempotencyKey: `gift-redeem-revoked:${input.appointmentId}:${entry.id}`,
      },
    });
  }
}

export async function listGiftCards(clinicId: string) {
  return prisma.giftCard.findMany({
    where: { clinicId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  });
}
