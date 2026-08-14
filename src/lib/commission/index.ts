import { prisma } from "@/lib/db";
import { formatBRL, money } from "@/lib/money";

export async function getProfessionalCommissions(params: {
  clinicId: string;
  from: Date;
  to: Date;
}) {
  const professionals = await prisma.professional.findMany({
    where: { clinicId: params.clinicId, active: true },
    select: { id: true, name: true, commissionPercent: true },
    orderBy: { name: "asc" },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: params.clinicId,
      status: "CONFIRMED",
      occurredAt: { gte: params.from, lte: params.to },
    },
    select: {
      paidAmount: true,
      cashbackGenerated: true,
      professionalName: true,
      items: { select: { professionalName: true, lineTotal: true } },
    },
  });

  const rows = professionals.map((pro) => {
    const pct = Number(pro.commissionPercent ?? 0);
    let revenue = money(0);
    let cashback = money(0);
    let sales = 0;
    for (const appt of appointments) {
      const names = [
        appt.professionalName,
        ...appt.items.map((i) => i.professionalName),
      ]
        .filter(Boolean)
        .map((n) => n!.toLowerCase());
      if (!names.includes(pro.name.toLowerCase())) continue;
      sales += 1;
      revenue = revenue.plus(appt.paidAmount);
      cashback = cashback.plus(appt.cashbackGenerated);
    }
    const commission = revenue.mul(pct).div(100);
    return {
      id: pro.id,
      name: pro.name,
      percent: pct,
      sales,
      revenue: formatBRL(revenue),
      cashback: formatBRL(cashback),
      commission: formatBRL(commission),
      revenueRaw: revenue.toNumber(),
    };
  });

  return rows.filter((r) => r.sales > 0 || r.percent > 0);
}
