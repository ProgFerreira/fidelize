import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { getCategoryProgress } from "@/lib/categories";
import { getBenefitSettings } from "@/lib/cashback";
import { listActivePackages } from "@/lib/packages";
import { clinicPortalUrl } from "@/lib/whatsapp/enqueue";

export type ReceptionCopilot = {
  availableBalance: string;
  maxRedemptionPercent: number;
  birthdayToday: boolean;
  birthdaySoon: boolean;
  daysToBirthday: number | null;
  categoryName: string | null;
  nextCategoryName: string | null;
  progressPercent: number;
  remainingSpend: string;
  almostUpgrade: boolean;
  packages: Array<{
    id: string;
    procedureName: string;
    remainingSessions: number;
    totalSessions: number;
    expiresAt: string | null;
    lastSession: boolean;
  }>;
  expiringSoonAmount: string;
  hasExpiringSoon: boolean;
  portalUrl: string;
  portalQrDataUrl: string;
  sharedWallet: boolean;
  holderName: string | null;
};

function daysUntilBirthday(birthDate: Date, now = new Date()) {
  const next = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  next.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export async function getReceptionCopilot(params: {
  clinicId: string;
  patientId: string;
  walletId: string;
}): Promise<ReceptionCopilot | null> {
  const { resolveBenefitWallet } = await import("@/lib/family");
  const family = await resolveBenefitWallet({
    clinicId: params.clinicId,
    patientId: params.patientId,
  }).catch(() => null);

  const walletId = family?.wallet.id ?? params.walletId;

  const [patient, wallet] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: params.patientId, clinicId: params.clinicId },
    }),
    prisma.wallet.findFirst({
      where: { id: walletId, clinicId: params.clinicId },
      include: { category: true },
    }),
  ]);
  if (!patient || !wallet) return null;

  const [settings, progress, packages, expiringLots, portalQrDataUrl] =
    await Promise.all([
      getBenefitSettings(params.clinicId),
      getCategoryProgress(wallet.id),
      listActivePackages({
        clinicId: params.clinicId,
        patientId: family?.holderPatientId ?? params.patientId,
      }),
      prisma.creditLot.findMany({
        where: {
          clinicId: params.clinicId,
          walletId: wallet.id,
          status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
          remainingAmount: { gt: 0 },
          expiresAt: {
            not: null,
            lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            gt: new Date(),
          },
        },
        select: { remainingAmount: true },
      }),
      QRCode.toDataURL(clinicPortalUrl("/paciente"), {
        width: 160,
        margin: 1,
      }),
    ]);

  const daysToBirthday = patient.birthDate
    ? daysUntilBirthday(patient.birthDate)
    : null;
  const expiringSoon = expiringLots.reduce(
    (sum, lot) => sum + Number(lot.remainingAmount),
    0,
  );

  return {
    availableBalance: formatBRL(wallet.availableBalance),
    maxRedemptionPercent: settings.maxRedemptionPercent ?? 30,
    birthdayToday: daysToBirthday === 0,
    birthdaySoon: daysToBirthday != null && daysToBirthday > 0 && daysToBirthday <= 7,
    daysToBirthday,
    categoryName: wallet.category?.name ?? progress?.current?.name ?? null,
    nextCategoryName: progress?.next?.name ?? null,
    progressPercent: progress?.progressPercent ?? 100,
    remainingSpend: progress?.remainingSpend ?? "0",
    almostUpgrade:
      Boolean(progress?.next) && (progress?.progressPercent ?? 0) >= 80,
    packages: packages.map((p) => ({
      id: p.id,
      procedureName: p.procedureName,
      remainingSessions: p.remainingSessions,
      totalSessions: p.totalSessions,
      expiresAt: p.expiresAt,
      lastSession: p.remainingSessions === 1,
    })),
    expiringSoonAmount: formatBRL(expiringSoon),
    hasExpiringSoon: expiringSoon > 0.009,
    portalUrl: clinicPortalUrl("/paciente"),
    portalQrDataUrl,
    sharedWallet: Boolean(family?.shared),
    holderName: family?.holderName ?? null,
  };
}
