import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";

export const rewardSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  pointsCost: z.coerce.number().int().min(1),
  stockTotal: z.coerce.number().int().optional().nullable(),
  limitPerPatient: z.coerce.number().int().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ENDED"]).default("DRAFT"),
  rules: z.string().max(2000).optional().nullable(),
});

export async function createReward(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof rewardSchema>;
}) {
  await requireModule(input.clinicId, "REWARDS");
  const data = rewardSchema.parse(input.data);
  return prisma.reward.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      description: data.description ?? null,
      pointsCost: data.pointsCost,
      stockTotal: data.stockTotal ?? null,
      limitPerPatient: data.limitPerPatient ?? null,
      status: data.status,
      rules: data.rules ?? null,
    },
  });
}

export async function redeemReward(input: {
  clinicId: string;
  patientId: string;
  rewardId: string;
  actorId?: string;
  idempotencyKey?: string;
}) {
  await requireModule(input.clinicId, "REWARDS");

  return prisma.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.rewardRedemption.findUnique({
        where: {
          clinicId_idempotencyKey: {
            clinicId: input.clinicId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return existing;
    }

    const reward = await tx.reward.findFirst({
      where: { id: input.rewardId, clinicId: input.clinicId, status: "ACTIVE" },
    });
    if (!reward) throw new Error("Recompensa indisponível");

    if (reward.stockTotal != null) {
      const available =
        reward.stockTotal - reward.stockReserved - reward.stockFulfilled;
      if (available <= 0) throw new Error("Estoque esgotado");
    }

    if (reward.limitPerPatient) {
      const count = await tx.rewardRedemption.count({
        where: {
          rewardId: reward.id,
          patientId: input.patientId,
          status: { notIn: ["CANCELLED"] },
        },
      });
      if (count >= reward.limitPerPatient) {
        throw new Error("Limite por paciente atingido");
      }
    }

    const walletRows = await tx.$queryRaw<
      Array<{ id: string; pointsBalance: number; version: number }>
    >`SELECT id, pointsBalance, version FROM Wallet
      WHERE clinicId = ${input.clinicId} AND patientId = ${input.patientId}
      FOR UPDATE`;
    const wallet = walletRows[0];
    if (!wallet) throw new Error("Carteira não encontrada");
    if (wallet.pointsBalance < reward.pointsCost) {
      throw new Error("Pontos insuficientes");
    }

    const newPoints = wallet.pointsBalance - reward.pointsCost;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        pointsBalance: newPoints,
        version: { increment: 1 },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        walletId: wallet.id,
        type: "DEBIT_REWARD",
        status: "COMPLETED",
        amount: "0",
        points: -reward.pointsCost,
        balanceBefore: "0",
        balanceAfter: "0",
        origin: "reward",
        reason: `Resgate: ${reward.name}`,
        operatorId: input.actorId,
        idempotencyKey: input.idempotencyKey
          ? `ledger:${input.idempotencyKey}`
          : undefined,
        metadata: { rewardId: reward.id },
      },
    });

    await tx.reward.update({
      where: { id: reward.id },
      data: { stockReserved: { increment: 1 } },
    });

    const redemption = await tx.rewardRedemption.create({
      data: {
        clinicId: input.clinicId,
        rewardId: reward.id,
        patientId: input.patientId,
        walletId: wallet.id,
        pointsSpent: reward.pointsCost,
        code: `RW${randomBytes(4).toString("hex").toUpperCase()}`,
        status: "PENDING_FULFILLMENT",
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });

    await tx.rewardStock.create({
      data: {
        rewardId: reward.id,
        delta: -1,
        reason: "RESERVE",
        actorId: input.actorId,
      },
    });

    return redemption;
  }).then(async (redemption) => {
    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "REWARD_REDEEM",
      entityType: "RewardRedemption",
      entityId: redemption.id,
      afterData: { code: redemption.code, points: redemption.pointsSpent },
    });
    return redemption;
  });
}

export async function fulfillReward(input: {
  clinicId: string;
  redemptionId: string;
  actorId: string;
  unitId?: string | null;
}) {
  const redemption = await prisma.$transaction(async (tx) => {
    const row = await tx.rewardRedemption.findFirst({
      where: { id: input.redemptionId, clinicId: input.clinicId },
    });
    if (!row) throw new Error("Resgate não encontrado");
    if (row.status === "FULFILLED") return row;
    if (row.status === "CANCELLED") throw new Error("Resgate cancelado");

    await tx.reward.update({
      where: { id: row.rewardId },
      data: {
        stockReserved: { decrement: 1 },
        stockFulfilled: { increment: 1 },
      },
    });

    return tx.rewardRedemption.update({
      where: { id: row.id },
      data: {
        status: "FULFILLED",
        fulfilledAt: new Date(),
        fulfilledBy: input.actorId,
        unitId: input.unitId ?? null,
      },
    });
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "REWARD_REDEEM",
    entityType: "RewardRedemption",
    entityId: redemption.id,
    afterData: { status: "FULFILLED" },
  });
  return redemption;
}

export async function listRewards(clinicId: string) {
  return prisma.reward.findMany({
    where: { clinicId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listRewardRedemptions(clinicId: string) {
  return prisma.rewardRedemption.findMany({
    where: { clinicId },
    include: {
      reward: { select: { name: true, pointsCost: true } },
      patient: { select: { fullName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
