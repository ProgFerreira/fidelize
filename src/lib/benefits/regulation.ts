import { prisma } from "@/lib/db";
import { getBenefitSettings } from "@/lib/cashback";
import { formatBRL } from "@/lib/money";

export async function getProgramRegulation(clinicId: string) {
  const [settings, clinic] = await Promise.all([
    getBenefitSettings(clinicId),
    prisma.clinic.findFirst({
      where: { id: clinicId },
      select: { name: true, tradeName: true },
    }),
  ]);
  const name = clinic?.tradeName || clinic?.name || "Clube de benefícios";
  return {
    clinicName: name,
    cashbackPercent: settings.defaultCashbackPercent,
    pointsPerReal: settings.pointsPerReal,
    releaseDays: settings.releaseDays,
    validityDays: settings.validityDays,
    maxRedemptionPercent: settings.maxRedemptionPercent ?? 30,
    maxCashbackPerTransaction: settings.maxCashbackPerTransaction,
    rules: [
      `Cashback padrão de ${settings.defaultCashbackPercent}% sobre o valor pago.`,
      settings.releaseDays > 0
        ? `O saldo fica disponível ${settings.releaseDays} dia(s) após o atendimento.`
        : "O saldo é liberado imediatamente após o atendimento.",
      `O benefício expira em ${settings.validityDays} dias após a liberação.`,
      `Em cada compra, no máximo ${settings.maxRedemptionPercent ?? 30}% do ticket pode ser pago com saldo.`,
      "O programa é promocional e não constitui investimento financeiro.",
    ],
    maxCashbackLabel:
      settings.maxCashbackPerTransaction != null
        ? formatBRL(settings.maxCashbackPerTransaction)
        : null,
  };
}
