import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import type { ProgressionMode } from "@/generated/prisma/client";

export async function recalculateCategory(walletId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: { category: true },
  });
  if (!wallet) return null;

  const categories = await prisma.category.findMany({
    where: { clinicId: wallet.clinicId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  if (categories.length === 0) return wallet;

  let matched = categories[0];
  for (const category of categories) {
    if (meetsCategory(category, wallet)) {
      matched = category;
    }
  }

  if (wallet.categoryId !== matched.id) {
    return prisma.wallet.update({
      where: { id: walletId },
      data: { categoryId: matched.id },
      include: { category: true },
    });
  }

  return prisma.wallet.findUnique({
    where: { id: walletId },
    include: { category: true },
  });
}

function meetsCategory(
  category: {
    progressionMode: ProgressionMode;
    minAnnualSpend: { toString(): string } | string | number;
    minPoints: number;
    minAppointments: number;
  },
  wallet: {
    annualSpend: { toString(): string } | string | number;
    pointsBalance: number;
    appointmentCount: number;
  },
) {
  const spendOk = money(String(wallet.annualSpend)).gte(
    String(category.minAnnualSpend),
  );
  const pointsOk = wallet.pointsBalance >= category.minPoints;
  const apptOk = wallet.appointmentCount >= category.minAppointments;

  switch (category.progressionMode) {
    case "SPEND":
      return spendOk;
    case "POINTS":
      return pointsOk;
    case "APPOINTMENTS":
      return apptOk;
    case "COMBINED":
      return spendOk && pointsOk && apptOk;
    default:
      return spendOk;
  }
}

export async function getCategoryProgress(walletId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: { category: true },
  });
  if (!wallet) return null;

  const categories = await prisma.category.findMany({
    where: { clinicId: wallet.clinicId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  const currentIndex = categories.findIndex((c) => c.id === wallet.categoryId);
  const next = categories[currentIndex + 1] ?? null;
  if (!next) {
    return {
      current: wallet.category,
      next: null,
      progressPercent: 100,
      remainingSpend: "0",
      remainingPoints: 0,
      remainingAppointments: 0,
    };
  }

  const spendProgress = money(String(wallet.annualSpend))
    .div(
      money(String(next.minAnnualSpend)).eq(0)
        ? 1
        : String(next.minAnnualSpend),
    )
    .mul(100)
    .toNumber();
  const pointsProgress =
    next.minPoints === 0 ? 100 : (wallet.pointsBalance / next.minPoints) * 100;
  const apptProgress =
    next.minAppointments === 0
      ? 100
      : (wallet.appointmentCount / next.minAppointments) * 100;

  let progressPercent = spendProgress;
  if (next.progressionMode === "POINTS") progressPercent = pointsProgress;
  if (next.progressionMode === "APPOINTMENTS") progressPercent = apptProgress;
  if (next.progressionMode === "COMBINED") {
    progressPercent = Math.min(spendProgress, pointsProgress, apptProgress);
  }

  return {
    current: wallet.category,
    next,
    progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
    remainingSpend: money(String(next.minAnnualSpend))
      .minus(String(wallet.annualSpend))
      .toFixed(2),
    remainingPoints: Math.max(0, next.minPoints - wallet.pointsBalance),
    remainingAppointments: Math.max(
      0,
      next.minAppointments - wallet.appointmentCount,
    ),
  };
}
