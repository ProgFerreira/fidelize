import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { money } from "@/lib/money";

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
  const card = await prisma.giftCard.update({
    where: { id: input.giftCardId },
    data: { status: "ACTIVE" },
  });
  if (card.clinicId !== input.clinicId) throw new Error("Vale inválido");
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

export async function redeemGiftCard(input: {
  clinicId: string;
  code: string;
  amount: number;
  actorId?: string;
}) {
  await requireModule(input.clinicId, "GIFT_CARD");
  return prisma.$transaction(async (tx) => {
    const card = await tx.giftCard.findFirst({
      where: { clinicId: input.clinicId, code: input.code },
    });
    if (!card || card.status === "CANCELLED" || card.status === "EXPIRED") {
      throw new Error("Vale-presente inválido");
    }
    if (card.status === "PENDING_PAYMENT") {
      throw new Error("Vale ainda não ativado");
    }
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new Error("Vale expirado");
    }

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
      },
    });

    const patientId = card.beneficiaryPatientId ?? card.buyerPatientId;
    if (patientId) {
      const wallet = await tx.wallet.findFirst({
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
            reason: `Uso vale-presente ${card.code}`,
            metadata: { giftCardId: card.id },
            operatorId: input.actorId,
            idempotencyKey: `gift-redeem:${card.id}:${use.toFixed(4)}:${remaining.toFixed(4)}`,
          },
        });
      }
    }

    return updated;
  }).then(async (card) => {
    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "GIFT_CARD",
      entityType: "GiftCard",
      entityId: card.id,
      afterData: { remaining: String(card.remainingAmount), status: card.status },
    });
    return card;
  });
}

export async function listGiftCards(clinicId: string) {
  return prisma.giftCard.findMany({
    where: { clinicId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  });
}
