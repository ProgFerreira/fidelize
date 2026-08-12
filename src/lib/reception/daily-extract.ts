import { prisma } from "@/lib/db";
import { money, moneyToNumber } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/payments/methods";
import { clinicRangeBounds } from "@/lib/datetime/clinic-day";

export type DailyExtractPayment = {
  method: string;
  label: string;
  amount: number;
};

export type DailyExtractSale = {
  id: string;
  ymd: string;
  time: string;
  patientName: string;
  professionalName: string | null;
  items: string;
  grossAmount: number;
  discountAmount: number;
  benefitUsed: number;
  paidAmount: number;
  payments: DailyExtractPayment[];
};

export type DailyExtractMethodTotal = {
  method: string;
  label: string;
  amount: number;
  count: number;
};

export type DailyExtract = {
  fromYmd: string;
  toYmd: string;
  timezone: string;
  sales: DailyExtractSale[];
  totals: {
    vendas: number;
    bruto: number;
    desconto: number;
    beneficio: number;
    recebido: number;
  };
  byMethod: DailyExtractMethodTotal[];
};

export async function getDailyExtract(input: {
  clinicId: string;
  fromYmd: string;
  toYmd?: string;
  timezone?: string;
}): Promise<DailyExtract> {
  const timezone = input.timezone || "America/Sao_Paulo";
  const { start, end, fromYmd, toYmd } = clinicRangeBounds(
    input.fromYmd,
    input.toYmd ?? input.fromYmd,
    timezone,
  );

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: input.clinicId,
      status: "CONFIRMED",
      occurredAt: { gte: start, lte: end },
    },
    include: {
      patient: { select: { fullName: true } },
      items: { orderBy: { sortOrder: "asc" } },
      procedure: { select: { name: true } },
      payments: {
        where: { status: "CONFIRMED" },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { occurredAt: "asc" },
  });

  const methodMap = new Map<
    string,
    { amount: ReturnType<typeof money>; count: number }
  >();
  let bruto = money(0);
  let desconto = money(0);
  let beneficio = money(0);
  let recebido = money(0);

  const sales: DailyExtractSale[] = appointments.map((apt) => {
    bruto = bruto.plus(apt.grossAmount);
    desconto = desconto.plus(apt.discountAmount);
    beneficio = beneficio.plus(apt.benefitUsed);

    const payments: DailyExtractPayment[] = apt.payments
      .filter((p) => money(p.amount).gt(0) || p.method === "gift_card")
      .map((p) => {
        const amount = moneyToNumber(money(p.amount).toDecimalPlaces(2));
        const method = p.method || "manual";
        const prev = methodMap.get(method) ?? {
          amount: money(0),
          count: 0,
        };
        prev.amount = prev.amount.plus(p.amount);
        prev.count += 1;
        methodMap.set(method, prev);
        recebido = recebido.plus(p.amount);
        return {
          method,
          label: paymentMethodLabel(method),
          amount,
        };
      });

    const itemLabel =
      apt.items.length > 0
        ? apt.items
            .map((i) => `${i.quantity}× ${i.name}`)
            .join(", ")
        : apt.procedure?.name || "Atendimento";

    return {
      id: apt.id,
      ymd: apt.occurredAt.toLocaleDateString("en-CA", { timeZone: timezone }),
      time: apt.occurredAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }),
      patientName: apt.patient.fullName,
      professionalName: apt.professionalName,
      items: itemLabel,
      grossAmount: moneyToNumber(money(apt.grossAmount).toDecimalPlaces(2)),
      discountAmount: moneyToNumber(money(apt.discountAmount).toDecimalPlaces(2)),
      benefitUsed: moneyToNumber(money(apt.benefitUsed).toDecimalPlaces(2)),
      paidAmount: moneyToNumber(money(apt.paidAmount).toDecimalPlaces(2)),
      payments,
    };
  });

  const byMethod: DailyExtractMethodTotal[] = [...methodMap.entries()]
    .map(([method, row]) => ({
      method,
      label: paymentMethodLabel(method),
      amount: moneyToNumber(row.amount.toDecimalPlaces(2)),
      count: row.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    fromYmd,
    toYmd,
    timezone,
    sales,
    totals: {
      vendas: sales.length,
      bruto: moneyToNumber(bruto.toDecimalPlaces(2)),
      desconto: moneyToNumber(desconto.toDecimalPlaces(2)),
      beneficio: moneyToNumber(beneficio.toDecimalPlaces(2)),
      recebido: moneyToNumber(recebido.toDecimalPlaces(2)),
    },
    byMethod,
  };
}
