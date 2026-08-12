import { prisma } from "@/lib/db";
import { money, percentOf, moneyToString } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export type BenefitSettings = {
  defaultCashbackPercent: number;
  pointsPerReal: number;
  releaseDays: number;
  validityDays: number;
  maxCashbackPerTransaction: number | null;
  maxRedemptionPercent: number | null;
  maxCashbackPerPatientPeriod: number | null;
  cashbackPeriodDays: number;
};

export const DEFAULT_SETTINGS: BenefitSettings = {
  defaultCashbackPercent: 5,
  pointsPerReal: 1,
  releaseDays: 0,
  validityDays: 180,
  maxCashbackPerTransaction: null,
  maxRedemptionPercent: 30,
  maxCashbackPerPatientPeriod: null,
  cashbackPeriodDays: 30,
};

export async function getBenefitSettings(clinicId: string): Promise<BenefitSettings> {
  const row = await prisma.setting.findUnique({
    where: { clinicId_key: { clinicId, key: "benefits" } },
  });
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<BenefitSettings>) };
}

export async function saveBenefitSettings(
  clinicId: string,
  value: BenefitSettings,
) {
  return prisma.setting.upsert({
    where: { clinicId_key: { clinicId, key: "benefits" } },
    create: { clinicId, key: "benefits", value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}

export type SimulationInput = {
  clinicId: string;
  categoryCashbackPercent?: number | null;
  procedureCashbackPercent?: number | null;
  campaignExtraPercent?: number | null;
  grossAmount: number;
  discountAmount?: number;
  benefitToUse?: number;
  availableBalance: number;
};

export type SimulationResult = {
  grossAmount: string;
  discountAmount: string;
  benefitUsed: string;
  paidAmount: string;
  cashbackPercent: string;
  cashbackAmount: string;
  points: number;
  settings: BenefitSettings;
  giftCardAmount?: string;
  giftCardCode?: string | null;
};

export async function simulateBenefit(
  input: SimulationInput,
): Promise<SimulationResult> {
  const settings = await getBenefitSettings(input.clinicId);
  const gross = money(input.grossAmount);
  const discount = money(input.discountAmount ?? 0);
  let benefit = money(input.benefitToUse ?? 0);
  const available = money(input.availableBalance);

  if (benefit.gt(available)) {
    benefit = available;
  }

  const afterDiscount = DecimalMax(gross.minus(discount), money(0));
  if (settings.maxRedemptionPercent != null) {
    const maxBenefit = afterDiscount.mul(settings.maxRedemptionPercent).div(100);
    if (benefit.gt(maxBenefit)) benefit = maxBenefit;
  }
  if (benefit.gt(afterDiscount)) benefit = afterDiscount;

  const paid = DecimalMax(afterDiscount.minus(benefit), money(0));

  let percent = money(settings.defaultCashbackPercent);
  if (input.categoryCashbackPercent != null) {
    percent = money(input.categoryCashbackPercent);
  }
  if (input.procedureCashbackPercent != null) {
    percent = money(input.procedureCashbackPercent);
  }
  if (input.campaignExtraPercent) {
    percent = percent.plus(input.campaignExtraPercent);
  }

  let cashback = percentOf(paid, percent);
  if (
    settings.maxCashbackPerTransaction != null &&
    cashback.gt(settings.maxCashbackPerTransaction)
  ) {
    cashback = money(settings.maxCashbackPerTransaction);
  }

  const points = Math.floor(
    paid.mul(settings.pointsPerReal).toDecimalPlaces(0).toNumber(),
  );

  return {
    grossAmount: moneyToString(gross),
    discountAmount: moneyToString(discount),
    benefitUsed: moneyToString(benefit),
    paidAmount: moneyToString(paid),
    cashbackPercent: moneyToString(percent),
    cashbackAmount: moneyToString(cashback),
    points,
    settings,
  };
}

/** Abate vale-presente do valor a pagar e recalcula cashback/pontos só sobre o caixa. */
export function applyGiftCardToSimulation(
  sim: SimulationResult,
  giftAmount: number,
  giftCardCode?: string | null,
): SimulationResult {
  const prepaid = money(Math.max(0, giftAmount));
  const paidBefore = money(sim.paidAmount);
  const used = prepaid.gt(paidBefore) ? paidBefore : prepaid;
  const paid = DecimalMax(paidBefore.minus(used), money(0));
  const percent = money(sim.cashbackPercent);
  let cashback = percentOf(paid, percent);
  if (
    sim.settings.maxCashbackPerTransaction != null &&
    cashback.gt(sim.settings.maxCashbackPerTransaction)
  ) {
    cashback = money(sim.settings.maxCashbackPerTransaction);
  }
  const points = Math.floor(
    paid.mul(sim.settings.pointsPerReal).toDecimalPlaces(0).toNumber(),
  );
  return {
    ...sim,
    paidAmount: moneyToString(paid),
    cashbackAmount: moneyToString(cashback),
    points,
    giftCardAmount: moneyToString(used),
    giftCardCode: giftCardCode ?? sim.giftCardCode ?? null,
  };
}

function DecimalMax(a: ReturnType<typeof money>, b: ReturnType<typeof money>) {
  return a.gt(b) ? a : b;
}

export function computeAvailabilityDates(settings: BenefitSettings, from = new Date()) {
  const availableAt = new Date(from);
  availableAt.setUTCDate(availableAt.getUTCDate() + settings.releaseDays);
  const expiresAt = new Date(availableAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + settings.validityDays);
  return { availableAt, expiresAt };
}
