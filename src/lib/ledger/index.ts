import { prisma, type TransacaoPrisma } from "@/lib/db";
import { money, moneyToString } from "@/lib/money";
import {
  LedgerType,
  type CreditLotStatus,
  type Prisma,
} from "@/generated/prisma/client";

type Tx = TransacaoPrisma;

/** All ledger types that credit the wallet (cashback/points in). */
export const CREDIT_LEDGER_TYPES = Object.values(LedgerType).filter((t) =>
  t.startsWith("CREDIT_"),
);

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

async function lockWallet(tx: Tx, walletId: string) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      clinicId: string;
      patientId: string;
      availableBalance: string;
      pendingBalance: string;
      pointsBalance: number;
      status: string;
      version: number;
    }>
  >`SELECT id, clinicId, patientId, availableBalance, pendingBalance, pointsBalance, status, version
    FROM Wallet WHERE id = ${walletId} FOR UPDATE`;

  if (!rows[0]) {
    throw new LedgerError("Carteira não encontrada");
  }
  if (rows[0].status !== "ACTIVE") {
    throw new LedgerError("Carteira bloqueada ou encerrada");
  }
  return rows[0];
}

async function findIdempotent(
  tx: Tx,
  clinicId: string,
  idempotencyKey?: string | null,
) {
  if (!idempotencyKey) return null;
  return tx.ledgerEntry.findUnique({
    where: {
      clinicId_idempotencyKey: { clinicId, idempotencyKey },
    },
  });
}

function lotStatus(remaining: string, original: string): CreditLotStatus {
  const rem = money(remaining);
  if (rem.lte(0)) return "USED";
  if (rem.lt(money(original))) return "PARTIALLY_USED";
  return "AVAILABLE";
}

export type CreditInput = {
  clinicId: string;
  walletId: string;
  patientId: string;
  amount: string | number;
  points?: number;
  type?: Extract<
    LedgerType,
    | "CREDIT_APPOINTMENT"
    | "CREDIT_CAMPAIGN"
    | "CREDIT_ADJUSTMENT"
    | "CREDIT_REFERRAL"
    | "CREDIT_BIRTHDAY"
    | "CREDIT_AUTOMATION"
    | "CREDIT_ACCELERATOR"
    | "ADJUSTMENT"
  >;
  origin?: string;
  appointmentId?: string;
  campaignId?: string;
  operatorId?: string;
  reason?: string;
  availableAt?: Date;
  expiresAt?: Date | null;
  unitId?: string | null;
  idempotencyKey?: string;
  pending?: boolean;
};

export async function creditWallet(input: CreditInput) {
  const amount = money(input.amount);
  if (amount.lte(0)) {
    throw new LedgerError("Valor de crédito deve ser positivo");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotent(tx, input.clinicId, input.idempotencyKey);
    if (existing) return { entry: existing, reused: true as const };

    const wallet = await lockWallet(tx, input.walletId);
    const before = money(wallet.availableBalance);
    const pendingBefore = money(wallet.pendingBalance);
    const isPending = Boolean(input.pending);
    const after = isPending ? before : before.plus(amount);
    const pendingAfter = isPending ? pendingBefore.plus(amount) : pendingBefore;

    const availableAt = input.availableAt ?? new Date();
    const lot = await tx.creditLot.create({
      data: {
        clinicId: input.clinicId,
        walletId: input.walletId,
        appointmentId: input.appointmentId,
        campaignId: input.campaignId,
        originalAmount: moneyToString(amount),
        remainingAmount: moneyToString(amount),
        status: isPending ? "PENDING" : "AVAILABLE",
        availableAt,
        expiresAt: input.expiresAt ?? null,
      },
    });

    const entry = await tx.ledgerEntry.create({
      data: {
        clinicId: input.clinicId,
        unitId: input.unitId ?? null,
        patientId: input.patientId,
        walletId: input.walletId,
        type: input.type ?? "CREDIT_APPOINTMENT",
        status: isPending ? "PENDING" : "COMPLETED",
        amount: moneyToString(amount),
        points: input.points ?? 0,
        balanceBefore: moneyToString(before),
        balanceAfter: moneyToString(after),
        origin: input.origin,
        appointmentId: input.appointmentId,
        campaignId: input.campaignId,
        creditLotId: lot.id,
        operatorId: input.operatorId,
        expiresAt: input.expiresAt ?? null,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: moneyToString(after),
        pendingBalance: moneyToString(pendingAfter),
        pointsBalance: { increment: input.points ?? 0 },
        version: { increment: 1 },
      },
    });

    return { entry, lot, reused: false as const };
  });
}

export type RedeemInput = {
  clinicId: string;
  walletId: string;
  patientId: string;
  amount: string | number;
  appointmentId?: string;
  operatorId?: string;
  unitId?: string | null;
  reason?: string;
  idempotencyKey?: string;
  maxPercentOfPaid?: number | null;
};

export async function redeemFromWallet(input: RedeemInput) {
  const amount = money(input.amount);
  if (amount.lte(0)) {
    throw new LedgerError("Valor de resgate deve ser positivo");
  }

  return prisma.$transaction(
    async (tx) => {
    const existing = await findIdempotent(tx, input.clinicId, input.idempotencyKey);
    if (existing) {
      return { entry: existing, reused: true as const, redemptionId: null };
    }

    const wallet = await lockWallet(tx, input.walletId);
    const before = money(wallet.availableBalance);
    if (before.lt(amount)) {
      throw new LedgerError("Saldo insuficiente para resgate");
    }

    const now = new Date();
    const lots = await tx.$queryRaw<
      Array<{
        id: string;
        remainingAmount: string;
        originalAmount: string;
        expiresAt: Date | null;
      }>
    >`SELECT id, remainingAmount, originalAmount, expiresAt
      FROM CreditLot
      WHERE walletId = ${input.walletId}
        AND status IN ('AVAILABLE', 'PARTIALLY_USED')
        AND remainingAmount > 0
        AND availableAt <= ${now}
        AND (expiresAt IS NULL OR expiresAt > ${now})
      ORDER BY expiresAt IS NULL ASC, expiresAt ASC, createdAt ASC
      FOR UPDATE`;

    let remaining = amount;
    const consumptions: Array<{ lotId: string; amount: string }> = [];

    for (const lot of lots) {
      if (remaining.lte(0)) break;
      const lotRemaining = money(lot.remainingAmount);
      const take = DecimalMin(lotRemaining, remaining);
      if (take.lte(0)) continue;

      const newRemaining = lotRemaining.minus(take);
      await tx.creditLot.update({
        where: { id: lot.id },
        data: {
          remainingAmount: moneyToString(newRemaining),
          status: lotStatus(moneyToString(newRemaining), lot.originalAmount),
        },
      });

      consumptions.push({ lotId: lot.id, amount: moneyToString(take) });
      remaining = remaining.minus(take);
    }

    if (remaining.gt(0)) {
      throw new LedgerError("Saldo disponível insuficiente nos lotes de crédito");
    }

    const after = before.minus(amount);
    if (after.lt(0)) {
      throw new LedgerError("Saldo não pode ficar negativo");
    }

    const entry = await tx.ledgerEntry.create({
      data: {
        clinicId: input.clinicId,
        unitId: input.unitId ?? null,
        patientId: input.patientId,
        walletId: input.walletId,
        type: "DEBIT_REDEMPTION",
        status: "COMPLETED",
        amount: moneyToString(amount),
        balanceBefore: moneyToString(before),
        balanceAfter: moneyToString(after),
        origin: "redemption",
        appointmentId: input.appointmentId,
        operatorId: input.operatorId,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const redemption = await tx.redemption.create({
      data: {
        clinicId: input.clinicId,
        walletId: input.walletId,
        appointmentId: input.appointmentId,
        operatorId: input.operatorId,
        amount: moneyToString(amount),
        idempotencyKey: input.idempotencyKey,
        items: {
          create: consumptions.map((c) => ({
            creditLotId: c.lotId,
            ledgerEntryId: entry.id,
            amount: c.amount,
          })),
        },
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: moneyToString(after),
        version: { increment: 1 },
      },
    });

    return { entry, redemptionId: redemption.id, reused: false as const };
  },
  {
    isolationLevel: "Serializable",
    maxWait: 10000,
    timeout: 20000,
  },
  );
}

function DecimalMin(a: ReturnType<typeof money>, b: ReturnType<typeof money>) {
  return a.lt(b) ? a : b;
}

export async function releasePendingLots(clinicId?: string) {
  const now = new Date();
  const pending = await prisma.creditLot.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: now },
      ...(clinicId ? { clinicId } : {}),
    },
    include: { wallet: true },
  });

  let released = 0;
  for (const lot of pending) {
    await prisma.$transaction(async (tx) => {
      const wallet = await lockWallet(tx, lot.walletId);
      const current = await tx.creditLot.findUnique({ where: { id: lot.id } });
      if (!current || current.status !== "PENDING") return;

      const available = money(wallet.availableBalance).plus(current.remainingAmount);
      const pendingBal = money(wallet.pendingBalance).minus(current.remainingAmount);

      await tx.creditLot.update({
        where: { id: lot.id },
        data: { status: "AVAILABLE" },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: moneyToString(available),
          pendingBalance: moneyToString(pendingBal.lt(0) ? 0 : pendingBal),
          version: { increment: 1 },
        },
      });

      await tx.ledgerEntry.updateMany({
        where: { creditLotId: lot.id, status: "PENDING" },
        data: { status: "COMPLETED" },
      });
    });
    released += 1;
  }
  return released;
}

export async function expireLots(clinicId?: string) {
  const now = new Date();
  const lots = await prisma.creditLot.findMany({
    where: {
      status: { in: ["AVAILABLE", "PARTIALLY_USED", "PENDING"] },
      expiresAt: { lte: now },
      remainingAmount: { gt: 0 },
      ...(clinicId ? { clinicId } : {}),
    },
    include: { wallet: true },
  });

  let expired = 0;
  for (const lot of lots) {
    const key = `expire:${lot.id}`;
    await prisma.$transaction(async (tx) => {
      const existing = await findIdempotent(tx, lot.clinicId, key);
      if (existing) return;

      const wallet = await lockWallet(tx, lot.walletId);
      const current = await tx.creditLot.findUnique({ where: { id: lot.id } });
      if (!current || money(current.remainingAmount).lte(0)) return;
      if (current.status === "EXPIRED" || current.status === "CANCELLED") return;

      const amount = money(current.remainingAmount);
      const wasPending = current.status === "PENDING";
      const before = money(wallet.availableBalance);
      const pendingBefore = money(wallet.pendingBalance);
      const after = wasPending ? before : before.minus(amount);
      const pendingAfter = wasPending
        ? pendingBefore.minus(amount)
        : pendingBefore;

      if (!wasPending && after.lt(0)) {
        throw new LedgerError("Inconsistência de saldo na expiração");
      }

      await tx.creditLot.update({
        where: { id: lot.id },
        data: {
          remainingAmount: moneyToString(0),
          status: "EXPIRED",
        },
      });

      await tx.ledgerEntry.create({
        data: {
          clinicId: lot.clinicId,
          patientId: wallet.patientId,
          walletId: lot.walletId,
          type: "DEBIT_EXPIRATION",
          status: "COMPLETED",
          amount: moneyToString(amount),
          balanceBefore: moneyToString(before),
          balanceAfter: moneyToString(after.lt(0) ? 0 : after),
          origin: "expiration",
          creditLotId: lot.id,
          reason: "Expiração automática de crédito",
          idempotencyKey: key,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: moneyToString(after.lt(0) ? 0 : after),
          pendingBalance: moneyToString(pendingAfter.lt(0) ? 0 : pendingAfter),
          version: { increment: 1 },
        },
      });
    });
    expired += 1;
  }
  return expired;
}

export async function reverseLedgerEntry(params: {
  clinicId: string;
  entryId: string;
  operatorId: string;
  reason: string;
  idempotencyKey?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const key = params.idempotencyKey ?? `reversal:${params.entryId}`;
    const existing = await findIdempotent(tx, params.clinicId, key);
    if (existing) return { entry: existing, reused: true as const };

    const original = await tx.ledgerEntry.findFirst({
      where: { id: params.entryId, clinicId: params.clinicId },
    });
    if (!original) throw new LedgerError("Lançamento não encontrado");
    if (original.status === "REVERSED") {
      throw new LedgerError("Lançamento já estornado");
    }

    const wallet = await lockWallet(tx, original.walletId);
    const before = money(wallet.availableBalance);
    const amount = money(original.amount);

    let after = before;
    const isCredit = original.type.startsWith("CREDIT") || original.type === "ADJUSTMENT";
    const isDebit =
      original.type === "DEBIT_REDEMPTION" ||
      original.type === "DEBIT_EXPIRATION";

    if (isCredit) {
      after = before.minus(amount);
      if (after.lt(0)) {
        throw new LedgerError("Não é possível estornar: saldo insuficiente");
      }
      if (original.creditLotId) {
        await tx.creditLot.update({
          where: { id: original.creditLotId },
          data: {
            remainingAmount: moneyToString(0),
            status: "CANCELLED",
          },
        });
      }
    } else if (isDebit) {
      after = before.plus(amount);
      if (original.type === "DEBIT_REDEMPTION") {
        const items = await tx.redemptionItem.findMany({
          where: { ledgerEntryId: original.id },
        });
        for (const item of items) {
          const lot = await tx.creditLot.findUnique({ where: { id: item.creditLotId } });
          if (!lot) continue;
          const newRemaining = money(lot.remainingAmount).plus(item.amount);
          await tx.creditLot.update({
            where: { id: lot.id },
            data: {
              remainingAmount: moneyToString(newRemaining),
              status:
                lot.status === "EXPIRED" || lot.status === "CANCELLED"
                  ? lot.status
                  : lotStatus(moneyToString(newRemaining), String(lot.originalAmount)),
            },
          });
        }
      }
    }

    const entry = await tx.ledgerEntry.create({
      data: {
        clinicId: params.clinicId,
        patientId: original.patientId,
        walletId: original.walletId,
        type: isCredit ? "REVERSAL_CREDIT" : "REVERSAL_REDEMPTION",
        status: "COMPLETED",
        amount: moneyToString(amount),
        balanceBefore: moneyToString(before),
        balanceAfter: moneyToString(after),
        origin: "reversal",
        appointmentId: original.appointmentId,
        operatorId: params.operatorId,
        originalEntryId: original.id,
        reason: params.reason,
        idempotencyKey: key,
      },
    });

    await tx.ledgerEntry.update({
      where: { id: original.id },
      data: { status: "REVERSED" },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: moneyToString(after),
        version: { increment: 1 },
      },
    });

    return { entry, reused: false as const };
  });
}
