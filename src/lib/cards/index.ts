import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import QRCode from "qrcode";

export async function createCardStock(params: {
  clinicId: string;
  unitId?: string | null;
  quantity: number;
  prefix?: string;
}) {
  const cards = [];
  const start = await prisma.card.count({ where: { clinicId: params.clinicId } });

  for (let i = 0; i < params.quantity; i++) {
    const seq = String(start + i + 1).padStart(8, "0");
    const cardNumber = `${params.prefix ?? "DERM"}${seq}`;
    cards.push({
      clinicId: params.clinicId,
      unitId: params.unitId ?? null,
      publicToken: randomUUID().replace(/-/g, ""),
      cardNumber,
      status: "AVAILABLE" as const,
    });
  }

  await prisma.card.createMany({ data: cards });
  return cards.length;
}

export async function linkCard(params: {
  clinicId: string;
  publicToken: string;
  walletId: string;
  actorId: string;
}) {
  const card = await prisma.card.findFirst({
    where: { clinicId: params.clinicId, publicToken: params.publicToken },
  });
  if (!card) throw new Error("Cartão não encontrado");
  if (card.status !== "AVAILABLE") {
    throw new Error("Cartão indisponível para vínculo");
  }

  const wallet = await prisma.wallet.findFirst({
    where: { id: params.walletId, clinicId: params.clinicId, status: "ACTIVE" },
  });
  if (!wallet) throw new Error("Carteira inválida");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.card.updateMany({
      where: {
        walletId: params.walletId,
        status: "ACTIVE",
        clinicId: params.clinicId,
      },
      data: { status: "REPLACED", blockedAt: new Date(), blockedReason: "Substituído" },
    });

    return tx.card.update({
      where: { id: card.id },
      data: {
        walletId: params.walletId,
        status: "ACTIVE",
        linkedAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_LINK",
    entityType: "Card",
    entityId: updated.id,
    afterData: { walletId: params.walletId, cardNumber: updated.cardNumber },
  });

  return updated;
}

export async function blockCard(params: {
  clinicId: string;
  cardId: string;
  actorId: string;
  reason: string;
}) {
  const card = await prisma.card.findFirst({
    where: { id: params.cardId, clinicId: params.clinicId },
  });
  if (!card) throw new Error("Cartão não encontrado");

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: {
      status: "BLOCKED",
      blockedAt: new Date(),
      blockedReason: params.reason,
    },
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_BLOCK",
    entityType: "Card",
    entityId: updated.id,
    afterData: { reason: params.reason },
  });

  return updated;
}

export async function findCardByToken(clinicId: string, publicToken: string) {
  return prisma.card.findFirst({
    where: { clinicId, publicToken },
    include: {
      wallet: {
        include: {
          patient: true,
          category: true,
        },
      },
    },
  });
}

export async function generateCardQrDataUrl(publicToken: string) {
  return QRCode.toDataURL(publicToken, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    color: { dark: "#0B1F33", light: "#FFFFFF" },
  });
}
