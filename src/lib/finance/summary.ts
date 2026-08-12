import { prisma } from "@/lib/db";
import { formatBRL, money, moneyToNumber } from "@/lib/money";

export type FinancePeriod = {
  start: Date;
  end: Date;
  label: string;
  rangeLabel: string;
};

export type FinanceChannel = {
  key: string;
  label: string;
  bruto: number;
  percent: number;
  color: string;
};

export type FinanceDayRow = {
  day: string;
  label: string;
  bruto: number;
  liquido: number;
  cashbackPct: number;
};

export type FinanceHighlight = {
  id: string;
  tone: "blue" | "green" | "orange" | "purple";
  icon: "calendar" | "trophy" | "percent" | "wallet" | "search";
  title: string;
  detail: string;
  emphasize?: boolean;
};

export type FinancialSummary = {
  period: FinancePeriod;
  registros: number;
  comRecebimento: number;
  zerados: number;
  bruto: number;
  liquido: number;
  custos: number;
  cashback: number;
  ticketMedio: number;
  liquidoPct: number;
  custosPct: number;
  channels: FinanceChannel[];
  channelInsight: string;
  daily: FinanceDayRow[];
  highlights: FinanceHighlight[];
};

const CHANNEL_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#06B6D4", "#EF4444"];

const METHOD_LABELS: Record<string, string> = {
  manual: "Venda presencial",
  presencial: "Venda presencial",
  dinheiro: "Dinheiro",
  pix: "PIX / Transferência",
  transferencia: "PIX / Transferência",
  link: "Link de pagamento",
  payment_link: "Link de pagamento",
  cartao: "Cartão",
  card: "Cartão",
  credito: "Cartão crédito",
  debito: "Cartão débito",
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDatePt(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function monthLabelPt(date: Date) {
  const raw = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function methodLabel(method: string | null | undefined) {
  const key = (method ?? "manual").trim().toLowerCase();
  return METHOD_LABELS[key] ?? (method?.trim() || "Outros");
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Aceita `YYYY-MM` ou usa o mês corrente. */
export function resolveFinancePeriod(mes?: string | null): FinancePeriod {
  let base = new Date();
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split("-").map(Number);
    base = new Date(y, m - 1, 1);
  }
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  return {
    start,
    end,
    label: monthLabelPt(start),
    rangeLabel: `${formatDatePt(start)} a ${formatDatePt(end)}`,
  };
}

export async function getFinancialSummary(
  clinicId: string,
  mes?: string | null,
): Promise<FinancialSummary> {
  const period = resolveFinancePeriod(mes);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      status: "CONFIRMED",
      occurredAt: { gte: period.start, lte: period.end },
    },
    include: {
      payments: { where: { status: "CONFIRMED" } },
      items: true,
      procedure: { select: { name: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  let bruto = money(0);
  let liquido = money(0);
  let descontos = money(0);
  let beneficios = money(0);
  let cashback = money(0);
  let comRecebimento = 0;
  let zerados = 0;

  const channelMap = new Map<string, ReturnType<typeof money>>();
  const serviceMap = new Map<string, ReturnType<typeof money>>();
  const dailyMap = new Map<
    string,
    { bruto: ReturnType<typeof money>; liquido: ReturnType<typeof money>; cashback: ReturnType<typeof money> }
  >();

  let bestDayKey = "";
  let bestDayBruto = money(0);
  let largest: {
    bruto: ReturnType<typeof money>;
    liquido: ReturnType<typeof money>;
    when: Date;
    channel: string;
  } | null = null;
  let maxCashbackPct = { pct: -1, label: "" };
  let minCashbackPct = { pct: Number.POSITIVE_INFINITY, label: "" };

  for (const apt of appointments) {
    const g = money(apt.grossAmount);
    const p = money(apt.paidAmount);
    const d = money(apt.discountAmount);
    const b = money(apt.benefitUsed);
    const c = money(apt.cashbackGenerated);

    bruto = bruto.plus(g);
    liquido = liquido.plus(p);
    descontos = descontos.plus(d);
    beneficios = beneficios.plus(b);
    cashback = cashback.plus(c);

    if (p.gt(0)) comRecebimento += 1;
    else zerados += 1;

    const payMethod =
      apt.payments.find((x) => x.method)?.method ??
      apt.payments[0]?.method ??
      "manual";
    const channel = methodLabel(payMethod);
    channelMap.set(channel, (channelMap.get(channel) ?? money(0)).plus(g));

    if (apt.items.length > 0) {
      for (const item of apt.items) {
        const name = item.name?.trim() || "Serviço";
        serviceMap.set(name, (serviceMap.get(name) ?? money(0)).plus(money(item.lineTotal)));
      }
    } else {
      const name = apt.procedure?.name?.trim() || "Atendimento";
      serviceMap.set(name, (serviceMap.get(name) ?? money(0)).plus(g));
    }

    const dk = dayKey(apt.occurredAt);
    const day = dailyMap.get(dk) ?? {
      bruto: money(0),
      liquido: money(0),
      cashback: money(0),
    };
    day.bruto = day.bruto.plus(g);
    day.liquido = day.liquido.plus(p);
    day.cashback = day.cashback.plus(c);
    dailyMap.set(dk, day);

    if (day.bruto.gt(bestDayBruto)) {
      bestDayBruto = day.bruto;
      bestDayKey = dk;
    }

    if (!largest || g.gt(largest.bruto)) {
      largest = { bruto: g, liquido: p, when: apt.occurredAt, channel };
    }

    if (g.gt(0)) {
      const pct = c.div(g).mul(100).toDecimalPlaces(2).toNumber();
      const label = channel;
      if (pct > maxCashbackPct.pct) maxCashbackPct = { pct, label };
      if (pct < minCashbackPct.pct) minCashbackPct = { pct, label };
    }
  }

  const custos = descontos.plus(beneficios);
  const brutoN = moneyToNumber(bruto.toDecimalPlaces(2));
  const liquidoN = moneyToNumber(liquido.toDecimalPlaces(2));
  const custosN = moneyToNumber(custos.toDecimalPlaces(2));
  const cashbackN = moneyToNumber(cashback.toDecimalPlaces(2));
  const liquidoPct =
    bruto.gt(0) ? liquido.div(bruto).mul(100).toDecimalPlaces(2).toNumber() : 0;
  const custosPct =
    bruto.gt(0) ? custos.div(bruto).mul(100).toDecimalPlaces(2).toNumber() : 0;
  const ticketMedio =
    comRecebimento > 0
      ? moneyToNumber(bruto.div(comRecebimento).toDecimalPlaces(2))
      : appointments.length > 0
        ? moneyToNumber(bruto.div(appointments.length).toDecimalPlaces(2))
        : 0;

  const useServices = channelMap.size <= 1 && serviceMap.size > 1;
  const sourceMap = useServices ? serviceMap : channelMap;
  const channelEntries = [...sourceMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value.cmp(a.value));

  const channels: FinanceChannel[] = channelEntries.map((entry, index) => {
    const value = moneyToNumber(entry.value.toDecimalPlaces(2));
    const percent =
      bruto.gt(0)
        ? entry.value.div(bruto).mul(100).toDecimalPlaces(2).toNumber()
        : 0;
    return {
      key: entry.label,
      label: entry.label,
      bruto: value,
      percent,
      color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    };
  });

  const topChannel = channels[0];
  const channelInsight = topChannel
    ? `${topChannel.label} representa ${topChannel.percent.toFixed(2).replace(".", ",")}% do faturamento bruto do período.`
    : "Sem faturamento no período selecionado.";

  const daily: FinanceDayRow[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, row]) => {
      const b = moneyToNumber(row.bruto.toDecimalPlaces(2));
      const l = moneyToNumber(row.liquido.toDecimalPlaces(2));
      const cashbackPct =
        row.bruto.gt(0)
          ? row.cashback.div(row.bruto).mul(100).toDecimalPlaces(2).toNumber()
          : 0;
      const [, , dd] = day.split("-");
      return {
        day,
        label: dd,
        bruto: b,
        liquido: l,
        cashbackPct,
      };
    });

  const highlights: FinanceHighlight[] = [];

  if (bestDayKey) {
    const [, , dd] = bestDayKey.split("-");
    const [y, m] = bestDayKey.split("-");
    highlights.push({
      id: "best-day",
      tone: "blue",
      icon: "calendar",
      title: "Melhor dia de vendas",
      detail: `${dd}/${m}/${y} · ${formatBRL(bestDayBruto)} (bruto)`,
    });
  }

  if (largest) {
    highlights.push({
      id: "largest",
      tone: "green",
      icon: "trophy",
      title: "Maior venda",
      detail: `${formatDatePt(largest.when)} · ${largest.channel} · ${formatBRL(largest.bruto)} (bruto) / ${formatBRL(largest.liquido)} (líquido)`,
    });
  }

  if (maxCashbackPct.pct >= 0) {
    highlights.push({
      id: "max-cb",
      tone: "orange",
      icon: "percent",
      title: "Maior custo de cashback",
      detail: `${maxCashbackPct.pct.toFixed(2).replace(".", ",")}% (${maxCashbackPct.label})`,
    });
  }

  if (Number.isFinite(minCashbackPct.pct) && minCashbackPct.pct !== Number.POSITIVE_INFINITY) {
    highlights.push({
      id: "min-cb",
      tone: "purple",
      icon: "wallet",
      title: "Menor custo de cashback",
      detail: `${minCashbackPct.pct.toFixed(2).replace(".", ",")}% (${minCashbackPct.label})`,
    });
  }

  if (zerados > 0) {
    highlights.push({
      id: "zeros",
      tone: "purple",
      icon: "search",
      title: "Conferência pendente",
      detail: `${zerados} registro${zerados === 1 ? "" : "s"} com valor líquido R$ 0,00 precisam de conferência.`,
      emphasize: true,
    });
  }

  return {
    period,
    registros: appointments.length,
    comRecebimento,
    zerados,
    bruto: brutoN,
    liquido: liquidoN,
    custos: custosN,
    cashback: cashbackN,
    ticketMedio,
    liquidoPct,
    custosPct,
    channels,
    channelInsight,
    daily,
    highlights,
  };
}
