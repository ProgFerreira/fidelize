import { prisma } from "@/lib/db";
import { formatBRL, money } from "@/lib/money";
import { CREDIT_LEDGER_TYPES } from "@/lib/ledger";

export async function getCashbackLiability(clinicId: string) {
  const lots = await prisma.creditLot.findMany({
    where: {
      clinicId,
      status: { in: ["AVAILABLE", "PARTIALLY_USED", "PENDING"] },
    },
    select: { remainingAmount: true, status: true, expiresAt: true },
  });

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let available = money(0);
  let pending = money(0);
  let expiring30 = money(0);

  for (const lot of lots) {
    const remaining = money(lot.remainingAmount);
    if (lot.status === "PENDING") pending = pending.plus(remaining);
    else available = available.plus(remaining);
    if (
      lot.expiresAt &&
      lot.expiresAt > now &&
      lot.expiresAt <= in30 &&
      lot.status !== "PENDING"
    ) {
      expiring30 = expiring30.plus(remaining);
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [issued, redeemed, expired] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        clinicId,
        createdAt: { gte: monthStart },
        type: { in: CREDIT_LEDGER_TYPES },
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        clinicId,
        createdAt: { gte: monthStart },
        type: { in: ["DEBIT_REDEMPTION", "DEBIT_REWARD"] },
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        clinicId,
        createdAt: { gte: monthStart },
        type: "DEBIT_EXPIRATION",
        status: "COMPLETED",
      },
      _sum: { amount: true },
    }),
  ]);

  const provisioned = available.plus(pending);
  return {
    available: formatBRL(available),
    pending: formatBRL(pending),
    expiring30: formatBRL(expiring30),
    provisioned: formatBRL(provisioned),
    issuedMonth: formatBRL(issued._sum.amount ?? 0),
    redeemedMonth: formatBRL(redeemed._sum.amount ?? 0),
    expiredMonth: formatBRL(expired._sum.amount ?? 0),
    availableRaw: available.toNumber(),
    pendingRaw: pending.toNumber(),
    expiring30Raw: expiring30.toNumber(),
  };
}
