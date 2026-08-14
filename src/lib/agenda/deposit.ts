import { prisma } from "@/lib/db";
import { redeemFromWallet, reverseLedgerEntry } from "@/lib/ledger";
import { money } from "@/lib/money";
import { resolveBenefitWallet } from "@/lib/family";

export async function applyBookingDeposit(params: {
  clinicId: string;
  eventId: string;
  patientId: string;
  method: "PIX" | "CASHBACK";
  amount: number;
}) {
  const amount = money(params.amount);
  if (amount.lte(0)) throw new Error("Informe o valor do sinal");

  const event = await prisma.scheduleEvent.findFirst({
    where: { id: params.eventId, clinicId: params.clinicId },
  });
  if (!event) throw new Error("Compromisso não encontrado");

  if (params.method === "CASHBACK") {
    const family = await resolveBenefitWallet({
      clinicId: params.clinicId,
      patientId: params.patientId,
    });
    const redeemed = await redeemFromWallet({
      clinicId: params.clinicId,
      walletId: family.wallet.id,
      patientId: family.holderPatientId,
      amount: amount.toString(),
      reason: `Sinal de agendamento ${event.title}`,
      idempotencyKey: `deposit-cashback:${event.id}`,
    });
    await prisma.scheduleEvent.update({
      where: { id: event.id },
      data: {
        depositAmount: amount.toString(),
        depositMethod: "CASHBACK",
        depositStatus: "CONFIRMED",
        depositLedgerId: redeemed.entry.id,
      },
    });
    return { status: "CONFIRMED" as const, method: "CASHBACK" as const };
  }

  await prisma.scheduleEvent.update({
    where: { id: event.id },
    data: {
      depositAmount: amount.toString(),
      depositMethod: "PIX",
      depositStatus: "PENDING",
    },
  });
  return { status: "PENDING" as const, method: "PIX" as const };
}

export async function confirmPixDeposit(params: {
  clinicId: string;
  eventId: string;
}) {
  const event = await prisma.scheduleEvent.findFirst({
    where: { id: params.eventId, clinicId: params.clinicId },
  });
  if (!event) throw new Error("Compromisso não encontrado");
  return prisma.scheduleEvent.update({
    where: { id: event.id },
    data: { depositStatus: "CONFIRMED" },
  });
}

export async function settleDepositOnStatus(params: {
  clinicId: string;
  eventId: string;
  nextStatus: string;
}) {
  const event = await prisma.scheduleEvent.findFirst({
    where: { id: params.eventId, clinicId: params.clinicId },
  });
  if (!event?.depositStatus || event.depositStatus === "REFUNDED" || event.depositStatus === "FORFEITED") {
    return;
  }

  if (params.nextStatus === "CANCELLED" && event.depositMethod === "CASHBACK" && event.depositLedgerId) {
    await reverseLedgerEntry({
      clinicId: params.clinicId,
      entryId: event.depositLedgerId,
      operatorId: "system",
      reason: "Estorno do sinal — consulta cancelada",
    }).catch(() => undefined);
    await prisma.scheduleEvent.update({
      where: { id: event.id },
      data: { depositStatus: "REFUNDED" },
    });
    return;
  }

  if (params.nextStatus === "NO_SHOW") {
    await prisma.scheduleEvent.update({
      where: { id: event.id },
      data: { depositStatus: "FORFEITED" },
    });
  }
}
