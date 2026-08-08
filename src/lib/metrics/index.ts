import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

export async function attributeCampaign(input: {
  clinicId: string;
  campaignId: string;
  patientId: string;
  appointmentId: string;
  revenue: number;
  benefitCost: number;
  windowDays?: number;
}) {
  const windowDays = input.windowDays ?? 30;
  const existingPrimary = await prisma.campaignAttribution.findFirst({
    where: {
      clinicId: input.clinicId,
      appointmentId: input.appointmentId,
      isPrimary: true,
    },
  });

  return prisma.campaignAttribution.create({
    data: {
      clinicId: input.clinicId,
      campaignId: input.campaignId,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      revenue: String(input.revenue),
      benefitCost: String(input.benefitCost),
      isPrimary: !existingPrimary,
      windowDays,
    },
  });
}

export async function campaignRoi(clinicId: string, campaignId: string) {
  const attrs = await prisma.campaignAttribution.findMany({
    where: { clinicId, campaignId },
  });
  const communications = await prisma.communication.findMany({
    where: { clinicId, campaignId },
  });

  let revenue = money(0);
  let benefitCost = money(0);
  let commCost = money(0);
  for (const a of attrs) {
    revenue = revenue.plus(money(a.revenue));
    benefitCost = benefitCost.plus(money(a.benefitCost));
    commCost = commCost.plus(money(a.commCost));
  }
  for (const c of communications) {
    if (c.estimatedCost) commCost = commCost.plus(money(c.estimatedCost));
  }

  const totalCost = benefitCost.plus(commCost);
  const net = revenue.minus(totalCost);
  const roi = totalCost.gt(0)
    ? net.div(totalCost).mul(100).toDecimalPlaces(2).toNumber()
    : null;

  return {
    impacted: await prisma.communication.count({
      where: { clinicId, campaignId, status: { in: ["SENT", "DELIVERED", "READ", "CLICKED"] } },
    }),
    attributedVisits: attrs.length,
    revenue: revenue.toFixed(2),
    benefitCost: benefitCost.toFixed(2),
    commCost: commCost.toFixed(2),
    netRevenue: net.toFixed(2),
    roi,
    conversion:
      communications.length > 0
        ? Math.round((attrs.length / communications.length) * 100)
        : 0,
  };
}

export async function advancedDashboardMetrics(clinicId: string) {
  const patients = await prisma.patient.count({ where: { clinicId, status: "ACTIVE" } });
  const wallets = await prisma.wallet.findMany({ where: { clinicId } });
  const appointments = await prisma.appointment.findMany({
    where: { clinicId, status: "CONFIRMED" },
    orderBy: { occurredAt: "asc" },
  });

  const totalSpend = wallets.reduce(
    (acc, w) => acc.plus(money(w.annualSpend)),
    money(0),
  );
  const avgBalance = wallets.length
    ? wallets
        .reduce((acc, w) => acc.plus(money(w.availableBalance)), money(0))
        .div(wallets.length)
    : money(0);

  const byPatient = new Map<string, Date[]>();
  for (const a of appointments) {
    const list = byPatient.get(a.patientId) ?? [];
    list.push(a.occurredAt);
    byPatient.set(a.patientId, list);
  }

  let intervalSum = 0;
  let intervalCount = 0;
  let recurring = 0;
  let firstTimers = 0;
  for (const dates of byPatient.values()) {
    if (dates.length === 1) firstTimers += 1;
    if (dates.length > 1) recurring += 1;
    for (let i = 1; i < dates.length; i++) {
      intervalSum +=
        (dates[i].getTime() - dates[i - 1].getTime()) / (24 * 60 * 60 * 1000);
      intervalCount += 1;
    }
  }

  const now = Date.now();
  const idle = [...byPatient.entries()].filter(([, dates]) => {
    const last = dates[dates.length - 1];
    return now - last.getTime() > 60 * 24 * 60 * 60 * 1000;
  }).length;

  const recovered = await prisma.recoveryCase.count({
    where: { clinicId, status: "RECOVERED" },
  });
  const recoveryOpen = await prisma.recoveryCase.count({
    where: { clinicId, status: { in: ["ATTENTION", "RISK", "INACTIVE"] } },
  });
  const referrals = await prisma.referral.groupBy({
    by: ["status"],
    where: { clinicId },
    _count: true,
  });
  const converted =
    referrals.find((r) => r.status === "BENEFIT_GRANTED" || r.status === "CONVERTED")
      ?._count ?? 0;
  const totalRef = referrals.reduce((a, r) => a + r._count, 0);

  const in7 = new Date(Date.now() + 7 * 86400000);
  const in15 = new Date(Date.now() + 15 * 86400000);
  const in30 = new Date(Date.now() + 30 * 86400000);
  const expiring = await prisma.creditLot.findMany({
    where: {
      clinicId,
      status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
      expiresAt: { not: null, gte: new Date(), lte: in30 },
    },
  });
  const sumExpiring = (until: Date) =>
    expiring
      .filter((l) => l.expiresAt && l.expiresAt <= until)
      .reduce((acc, l) => acc.plus(money(l.remainingAmount)), money(0))
      .toFixed(2);

  const topRewards = await prisma.rewardRedemption.groupBy({
    by: ["rewardId"],
    where: { clinicId, status: { not: "CANCELLED" } },
    _count: true,
    orderBy: { _count: { rewardId: "desc" } },
    take: 5,
  });
  const rewardNames = await prisma.reward.findMany({
    where: { id: { in: topRewards.map((r) => r.rewardId) } },
  });

  const channelStats = await prisma.communication.groupBy({
    by: ["channel", "status"],
    where: { clinicId },
    _count: true,
  });

  const npsResponses = await prisma.surveyResponse.findMany({
    where: { clinicId, respondedAt: { not: null }, score: { gte: 0 } },
  });
  const promoters = npsResponses.filter((r) => r.classification === "PROMOTER").length;
  const detractors = npsResponses.filter((r) => r.classification === "DETRACTOR").length;
  const nps = npsResponses.length
    ? Math.round(((promoters - detractors) / npsResponses.length) * 100)
    : null;

  return {
    patients,
    ltvEstimate: patients
      ? totalSpend.div(patients).toFixed(2)
      : "0.00",
    avgFrequency: patients
      ? (appointments.length / patients).toFixed(2)
      : "0.00",
    avgIntervalDays: intervalCount ? Math.round(intervalSum / intervalCount) : null,
    recurring,
    firstTimers,
    idle,
    recoveryRate:
      recovered + recoveryOpen > 0
        ? Math.round((recovered / (recovered + recoveryOpen)) * 100)
        : 0,
    referralRate: patients ? Math.round((totalRef / patients) * 100) : 0,
    referralConversion: totalRef ? Math.round((converted / totalRef) * 100) : 0,
    avgBalance: avgBalance.toFixed(2),
    balanceExpiring7: sumExpiring(in7),
    balanceExpiring15: sumExpiring(in15),
    balanceExpiring30: sumExpiring(in30),
    topRewards: topRewards.map((r) => ({
      rewardId: r.rewardId,
      name: rewardNames.find((n) => n.id === r.rewardId)?.name ?? r.rewardId,
      count: r._count,
    })),
    channelEfficiency: channelStats,
    nps,
    npsResponseCount: npsResponses.length,
  };
}
