import { prisma } from "@/lib/db";

export async function getReceptionKpi(clinicId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [sales, withCard, withBenefit, scheduled] = await Promise.all([
    prisma.appointment.count({
      where: { clinicId, status: "CONFIRMED", occurredAt: { gte: start, lte: end } },
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: "CONFIRMED",
        occurredAt: { gte: start, lte: end },
        wallet: { cards: { some: { status: "ACTIVE" } } },
      },
    }),
    prisma.appointment.count({
      where: {
        clinicId,
        status: "CONFIRMED",
        occurredAt: { gte: start, lte: end },
        benefitUsed: { gt: 0 },
      },
    }),
    prisma.scheduleEvent.count({
      where: {
        clinicId,
        startsAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED"] },
        patientId: { not: null },
      },
    }),
  ]);

  const identifiedPct = sales === 0 ? 100 : Math.round((withCard / sales) * 100);
  return {
    sales,
    withCard,
    withBenefit,
    scheduled,
    identifiedPct,
  };
}
