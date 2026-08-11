import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { CardKind, Prisma } from "@/generated/prisma/client";
import QRCode from "qrcode";

export type CardSettings = {
  prefix: string;
  lowStockThreshold: number;
  defaultValidityDays: number | null;
};

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  prefix: "DERM",
  lowStockThreshold: 20,
  defaultValidityDays: null,
};

function sanitizePrefix(raw: string | null | undefined, fallback = "DERM") {
  const cleaned = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned || fallback;
}

export async function getCardSettings(clinicId: string): Promise<CardSettings> {
  const row = await prisma.setting.findUnique({
    where: { clinicId_key: { clinicId, key: "cards" } },
  });
  if (!row) return DEFAULT_CARD_SETTINGS;
  const value = row.value as Partial<CardSettings>;
  return {
    prefix: sanitizePrefix(value.prefix, DEFAULT_CARD_SETTINGS.prefix),
    lowStockThreshold: Math.max(
      1,
      Math.trunc(Number(value.lowStockThreshold) || DEFAULT_CARD_SETTINGS.lowStockThreshold),
    ),
    defaultValidityDays:
      value.defaultValidityDays == null || value.defaultValidityDays === ("" as never)
        ? null
        : Math.max(1, Math.trunc(Number(value.defaultValidityDays))),
  };
}

export async function saveCardSettings(clinicId: string, value: CardSettings) {
  const normalized: CardSettings = {
    prefix: sanitizePrefix(value.prefix),
    lowStockThreshold: Math.max(1, Math.trunc(value.lowStockThreshold)),
    defaultValidityDays:
      value.defaultValidityDays == null
        ? null
        : Math.max(1, Math.trunc(value.defaultValidityDays)),
  };
  return prisma.setting.upsert({
    where: { clinicId_key: { clinicId, key: "cards" } },
    create: {
      clinicId,
      key: "cards",
      value: normalized as unknown as Prisma.InputJsonValue,
    },
    update: { value: normalized as unknown as Prisma.InputJsonValue },
  });
}

function expiresFromDays(days: number | null | undefined) {
  if (days == null || !Number.isFinite(days) || days <= 0) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Math.trunc(days));
  return d;
}

export async function createCardStock(params: {
  clinicId: string;
  unitId?: string | null;
  quantity: number;
  prefix?: string;
  validityDays?: number | null;
  actorId?: string;
}) {
  const quantity = Math.trunc(params.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 500) {
    throw new Error("Quantidade inválida (1–500)");
  }

  const settings = await getCardSettings(params.clinicId);
  const prefix = sanitizePrefix(params.prefix ?? settings.prefix);
  const validityDays =
    params.validityDays === undefined
      ? settings.defaultValidityDays
      : params.validityDays;
  const expiresAt = expiresFromDays(validityDays);

  if (params.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: params.unitId, clinicId: params.clinicId, active: true },
    });
    if (!unit) throw new Error("Unidade inválida");
  }

  const start = await prisma.card.count({ where: { clinicId: params.clinicId } });
  const cards = [];

  for (let i = 0; i < quantity; i++) {
    const seq = String(start + i + 1).padStart(8, "0");
    cards.push({
      clinicId: params.clinicId,
      unitId: params.unitId ?? null,
      publicToken: randomUUID().replace(/-/g, ""),
      cardNumber: `${prefix}${seq}`,
      kind: "PHYSICAL" as const,
      status: "AVAILABLE" as const,
      expiresAt,
    });
  }

  await prisma.card.createMany({ data: cards });

  if (params.actorId) {
    await writeAuditLog({
      clinicId: params.clinicId,
      userId: params.actorId,
      action: "CARD_STOCK",
      entityType: "Card",
      afterData: {
        quantity,
        prefix,
        unitId: params.unitId ?? null,
        validityDays: validityDays ?? null,
      },
    });
  }

  return { count: cards.length, prefix, expiresAt };
}

export async function issueVirtualCard(params: {
  clinicId: string;
  walletId: string;
  actorId: string;
  unitId?: string | null;
  validityDays?: number | null;
}) {
  const wallet = await prisma.wallet.findFirst({
    where: { id: params.walletId, clinicId: params.clinicId, status: "ACTIVE" },
    include: { patient: { select: { id: true, fullName: true } } },
  });
  if (!wallet) throw new Error("Carteira inválida");

  const settings = await getCardSettings(params.clinicId);
  const prefix = sanitizePrefix(`${settings.prefix}V`);
  const validityDays =
    params.validityDays === undefined
      ? settings.defaultValidityDays
      : params.validityDays;
  const expiresAt = expiresFromDays(validityDays);
  const start = await prisma.card.count({ where: { clinicId: params.clinicId } });
  const cardNumber = `${prefix}${String(start + 1).padStart(8, "0")}`;

  const created = await prisma.$transaction(async (tx) => {
    await tx.card.updateMany({
      where: {
        clinicId: params.clinicId,
        walletId: params.walletId,
        status: "ACTIVE",
        kind: "VIRTUAL",
      },
      data: {
        status: "REPLACED",
        blockedAt: new Date(),
        blockedReason: "Substituído por novo cartão virtual",
      },
    });

    return tx.card.create({
      data: {
        clinicId: params.clinicId,
        unitId: params.unitId ?? null,
        walletId: params.walletId,
        publicToken: randomUUID().replace(/-/g, ""),
        cardNumber,
        kind: "VIRTUAL",
        status: "ACTIVE",
        linkedAt: new Date(),
        expiresAt,
      },
    });
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_LINK",
    entityType: "Card",
    entityId: created.id,
    afterData: {
      kind: "VIRTUAL",
      walletId: params.walletId,
      patientId: wallet.patient.id,
      cardNumber: created.cardNumber,
    },
  });

  return created;
}

export async function linkCard(params: {
  clinicId: string;
  publicToken: string;
  walletId: string;
  actorId: string;
}) {
  const token = params.publicToken.trim();
  if (!token) throw new Error("Token do cartão obrigatório");

  const card = await prisma.card.findFirst({
    where: { clinicId: params.clinicId, publicToken: token },
  });
  if (!card) throw new Error("Cartão não encontrado");
  if (card.status !== "AVAILABLE") {
    throw new Error("Cartão indisponível para vínculo");
  }
  if (card.expiresAt && card.expiresAt < new Date()) {
    throw new Error("Cartão expirado");
  }

  const wallet = await prisma.wallet.findFirst({
    where: { id: params.walletId, clinicId: params.clinicId, status: "ACTIVE" },
  });
  if (!wallet) throw new Error("Carteira inválida");

  const kind: CardKind = card.kind;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.card.updateMany({
      where: {
        walletId: params.walletId,
        status: "ACTIVE",
        clinicId: params.clinicId,
        kind,
      },
      data: {
        status: "REPLACED",
        blockedAt: new Date(),
        blockedReason: "Substituído",
      },
    });

    return tx.card.update({
      where: { id: card.id },
      data: {
        walletId: params.walletId,
        status: "ACTIVE",
        linkedAt: new Date(),
        blockedAt: null,
        blockedReason: null,
      },
    });
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_LINK",
    entityType: "Card",
    entityId: updated.id,
    afterData: {
      walletId: params.walletId,
      cardNumber: updated.cardNumber,
      kind: updated.kind,
    },
  });

  return updated;
}

export async function replaceCard(params: {
  clinicId: string;
  oldCardId: string;
  newCardId?: string | null;
  newPublicToken?: string | null;
  actorId: string;
  reason?: string;
}) {
  const oldCard = await prisma.card.findFirst({
    where: { id: params.oldCardId, clinicId: params.clinicId },
  });
  if (!oldCard) throw new Error("Cartão atual não encontrado");
  if (oldCard.status !== "ACTIVE" && oldCard.status !== "BLOCKED") {
    throw new Error("Só é possível emitir 2ª via de cartão ativo ou bloqueado");
  }
  if (!oldCard.walletId) throw new Error("Cartão sem vínculo com paciente");

  const newCard = params.newCardId
    ? await prisma.card.findFirst({
        where: { id: params.newCardId, clinicId: params.clinicId },
      })
    : params.newPublicToken
      ? await prisma.card.findFirst({
          where: {
            clinicId: params.clinicId,
            publicToken: params.newPublicToken.trim(),
          },
        })
      : null;

  if (!newCard) throw new Error("Novo cartão não encontrado");
  if (newCard.status !== "AVAILABLE") {
    throw new Error("O novo cartão precisa estar disponível no estoque");
  }
  if (newCard.kind !== "PHYSICAL") {
    throw new Error("2ª via física exige cartão físico do estoque");
  }
  if (newCard.expiresAt && newCard.expiresAt < new Date()) {
    throw new Error("Novo cartão expirado");
  }

  const reason = (params.reason || "2ª via / substituição").trim();

  const result = await prisma.$transaction(async (tx) => {
    const replacement = await tx.card.update({
      where: { id: newCard.id },
      data: {
        walletId: oldCard.walletId,
        status: "ACTIVE",
        linkedAt: new Date(),
        blockedAt: null,
        blockedReason: null,
        unitId: newCard.unitId ?? oldCard.unitId,
      },
    });

    await tx.card.update({
      where: { id: oldCard.id },
      data: {
        status: "REPLACED",
        blockedAt: new Date(),
        blockedReason: reason,
        replacedById: replacement.id,
      },
    });

    return replacement;
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_REPLACE",
    entityType: "Card",
    entityId: result.id,
    beforeData: {
      oldCardId: oldCard.id,
      oldCardNumber: oldCard.cardNumber,
      status: oldCard.status,
    },
    afterData: {
      newCardId: result.id,
      newCardNumber: result.cardNumber,
      walletId: oldCard.walletId,
      reason,
    },
  });

  return result;
}

export async function blockCard(params: {
  clinicId: string;
  cardId: string;
  actorId: string;
  reason: string;
}) {
  const reason = params.reason.trim();
  if (!reason) throw new Error("Informe o motivo do bloqueio");

  const card = await prisma.card.findFirst({
    where: { id: params.cardId, clinicId: params.clinicId },
  });
  if (!card) throw new Error("Cartão não encontrado");
  if (card.status === "BLOCKED") throw new Error("Cartão já está bloqueado");
  if (card.status === "REPLACED" || card.status === "CANCELLED") {
    throw new Error("Não é possível bloquear este cartão");
  }

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: {
      status: "BLOCKED",
      blockedAt: new Date(),
      blockedReason: reason,
    },
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_BLOCK",
    entityType: "Card",
    entityId: updated.id,
    afterData: { reason, cardNumber: updated.cardNumber },
  });

  return updated;
}

export async function unblockCard(params: {
  clinicId: string;
  cardId: string;
  actorId: string;
  reason?: string;
}) {
  const card = await prisma.card.findFirst({
    where: { id: params.cardId, clinicId: params.clinicId },
  });
  if (!card) throw new Error("Cartão não encontrado");
  if (card.status !== "BLOCKED") {
    throw new Error("Somente cartões bloqueados podem ser desbloqueados");
  }

  const nextStatus = card.walletId ? "ACTIVE" : "AVAILABLE";
  const reason = (params.reason || "Desbloqueio administrativo").trim();

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: {
      status: nextStatus,
      blockedAt: null,
      blockedReason: null,
    },
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "CARD_UNBLOCK",
    entityType: "Card",
    entityId: updated.id,
    afterData: {
      reason,
      cardNumber: updated.cardNumber,
      status: nextStatus,
    },
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

export async function getStockAlerts(clinicId: string) {
  const settings = await getCardSettings(clinicId);
  const groups = await prisma.card.groupBy({
    by: ["unitId"],
    where: { clinicId, status: "AVAILABLE", kind: "PHYSICAL" },
    _count: { _all: true },
  });

  const unitIds = groups.map((g) => g.unitId).filter(Boolean) as string[];
  const units = unitIds.length
    ? await prisma.unit.findMany({
        where: { clinicId, id: { in: unitIds } },
        select: { id: true, name: true },
      })
    : [];
  const unitName = new Map(units.map((u) => [u.id, u.name]));

  const alerts = groups
    .map((g) => ({
      unitId: g.unitId,
      unitName: g.unitId ? (unitName.get(g.unitId) ?? "Unidade") : "Estoque geral",
      available: g._count._all,
      threshold: settings.lowStockThreshold,
      low: g._count._all < settings.lowStockThreshold,
    }))
    .filter((a) => a.low)
    .sort((a, b) => a.available - b.available);

  return { settings, alerts, groups: groups.map((g) => ({
    unitId: g.unitId,
    available: g._count._all,
  })) };
}

export async function getCardHistory(clinicId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, clinicId },
    select: { id: true, replacedById: true },
  });
  if (!card) return [];

  const previous = await prisma.card.findMany({
    where: { clinicId, replacedById: cardId },
    select: { id: true },
  });

  const relatedIds = [
    cardId,
    card.replacedById,
    ...previous.map((p) => p.id),
  ].filter(Boolean) as string[];

  return prisma.auditLog.findMany({
    where: {
      clinicId,
      entityType: "Card",
      entityId: { in: relatedIds },
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function searchPatientsForCardLink(
  clinicId: string,
  query: string,
) {
  const q = query.trim();
  if (q.length < 2) return [];

  const patients = await prisma.patient.findMany({
    where: {
      clinicId,
      status: "ACTIVE",
      OR: [
        { fullName: { contains: q } },
        { cpf: { contains: q.replace(/\D/g, "") || q } },
        { phone: { contains: q.replace(/\D/g, "") || q } },
      ],
    },
    include: {
      wallets: {
        where: { clinicId, status: "ACTIVE" },
        take: 1,
        select: { id: true },
      },
    },
    take: 12,
    orderBy: { fullName: "asc" },
  });

  return patients
    .filter((p) => p.wallets[0])
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      walletId: p.wallets[0]!.id,
    }));
}

export async function listCardsForPrint(params: {
  clinicId: string;
  ids?: string[];
  status?: "AVAILABLE" | "ACTIVE";
  unitId?: string | null;
  take?: number;
}) {
  const take = Math.min(params.take ?? 100, 200);
  return prisma.card.findMany({
    where: {
      clinicId: params.clinicId,
      kind: "PHYSICAL",
      ...(params.ids?.length ? { id: { in: params.ids } } : {}),
      ...(params.status ? { status: params.status } : { status: "AVAILABLE" }),
      ...(params.unitId ? { unitId: params.unitId } : {}),
    },
    include: {
      unit: { select: { name: true } },
      wallet: { include: { patient: { select: { fullName: true } } } },
    },
    orderBy: { cardNumber: "asc" },
    take,
  });
}
