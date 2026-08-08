import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule, isModuleEnabled } from "@/lib/modules";
import { money } from "@/lib/money";

function bandFromScore(score: number) {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/** Heurística de churn/abandono — sem dados clínicos */
export async function computePatientPredictions(clinicId: string) {
  if (!(await isModuleEnabled(clinicId, "PREDICTIVE"))) {
    await requireModule(clinicId, "PREDICTIVE");
  }

  const patients = await prisma.patient.findMany({
    where: { clinicId, status: "ACTIVE" },
    include: {
      wallets: true,
      appointments: {
        where: { status: "CONFIRMED" },
        orderBy: { occurredAt: "desc" },
        take: 12,
      },
      communications: {
        where: { status: { in: ["SENT", "DELIVERED", "READ", "FAILED"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
    take: 500,
  });

  const now = Date.now();
  let updated = 0;

  for (const patient of patients) {
    const wallet = patient.wallets[0];
    const lastAppt = patient.appointments[0]?.occurredAt ?? patient.registeredAt;
    const daysInactive = Math.floor((now - lastAppt.getTime()) / 86400000);
    const visits = wallet?.appointmentCount ?? patient.appointments.length;
    const spend = Number(wallet?.annualSpend ?? 0);
    const balance = Number(wallet?.availableBalance ?? 0);
    const failedComms = patient.communications.filter((c) => c.status === "FAILED")
      .length;

    // Churn risk 0–100
    let churn = 10;
    churn += Math.min(daysInactive, 180) * 0.35;
    if (visits <= 1) churn += 15;
    if (balance > 0 && daysInactive > 45) churn += 10;
    if (failedComms >= 2) churn += 8;
    if (!patient.marketingConsent) churn += 5;
    churn = Math.max(0, Math.min(100, Math.round(churn)));

    // LTV estimado simples
    const avgTicket = visits > 0 ? spend / visits : spend;
    const expectedVisitsYear = visits > 0 ? Math.max(1, 365 / Math.max(daysInactive, 30)) : 1;
    const ltv = money(avgTicket).mul(expectedVisitsYear).mul(2).toDecimalPlaces(2);

    // Risco de abandono de saldo
    let abandon = balance <= 0 ? 5 : 20 + Math.min(daysInactive, 90) * 0.5;
    if (balance > 100 && daysInactive > 30) abandon += 20;
    abandon = Math.max(0, Math.min(100, Math.round(abandon)));

    const rows = [
      {
        scoreType: "CHURN_RISK",
        score: String(churn),
        band: bandFromScore(churn),
        factors: {
          daysInactive,
          visits,
          failedComms,
          marketingConsent: patient.marketingConsent,
        },
      },
      {
        scoreType: "LTV_ESTIMATE",
        score: ltv.toFixed(2),
        band: null as string | null,
        factors: { avgTicket, expectedVisitsYear, spend },
      },
      {
        scoreType: "ABANDON_RISK",
        score: String(abandon),
        band: bandFromScore(abandon),
        factors: { balance, daysInactive },
      },
    ];

    for (const row of rows) {
      await prisma.predictionScore.upsert({
        where: {
          clinicId_patientId_scoreType: {
            clinicId,
            patientId: patient.id,
            scoreType: row.scoreType,
          },
        },
        create: {
          clinicId,
          patientId: patient.id,
          scoreType: row.scoreType,
          score: row.score,
          band: row.band,
          factors: row.factors,
          computedAt: new Date(),
        },
        update: {
          score: row.score,
          band: row.band,
          factors: row.factors,
          computedAt: new Date(),
        },
      });
      updated += 1;
    }
  }

  await writeAuditLog({
    clinicId,
    action: "PREDICTION_RUN",
    entityType: "PredictionScore",
    entityId: clinicId,
    afterData: { patients: patients.length, scores: updated },
  });

  return { patients: patients.length, scores: updated };
}

export async function forecastRevenue(clinicId: string, months = 3) {
  await requireModule(clinicId, "PREDICTIVE");
  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      status: "CONFIRMED",
      occurredAt: { gte: since },
    },
    select: { paidAmount: true, occurredAt: true },
  });

  const byMonth = new Map<string, number>();
  for (const a of appointments) {
    const key = a.occurredAt.toISOString().slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(a.paidAmount));
  }
  const values = [...byMonth.values()];
  const avg =
    values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  // tendência linear simples
  const trend =
    values.length >= 2 ? (values[values.length - 1] - values[0]) / values.length : 0;

  const forecasts = [];
  for (let i = 1; i <= months; i++) {
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() + i);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    const predicted = Math.max(0, avg + trend * i);
    const row = await prisma.revenueForecast.upsert({
      where: {
        clinicId_periodStart_periodEnd_method: {
          clinicId,
          periodStart: start,
          periodEnd: end,
          method: "moving_avg_trend",
        },
      },
      create: {
        clinicId,
        periodStart: start,
        periodEnd: end,
        predictedRevenue: String(predicted.toFixed(2)),
        confidence: String(Math.min(0.9, 0.4 + values.length * 0.08).toFixed(2)),
        method: "moving_avg_trend",
        breakdown: { avg, trend, historyMonths: values.length },
      },
      update: {
        predictedRevenue: String(predicted.toFixed(2)),
        confidence: String(Math.min(0.9, 0.4 + values.length * 0.08).toFixed(2)),
        breakdown: { avg, trend, historyMonths: values.length },
        computedAt: new Date(),
      },
    });
    forecasts.push(row);
  }

  await writeAuditLog({
    clinicId,
    action: "PREDICTION_RUN",
    entityType: "RevenueForecast",
    entityId: clinicId,
    afterData: { months, count: forecasts.length },
  });

  return forecasts;
}

export async function listHighRiskPatients(clinicId: string, limit = 50) {
  return prisma.predictionScore.findMany({
    where: {
      clinicId,
      scoreType: "CHURN_RISK",
      band: { in: ["HIGH", "MEDIUM"] },
    },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { score: "desc" },
    take: limit,
  });
}

export async function listForecasts(clinicId: string) {
  return prisma.revenueForecast.findMany({
    where: { clinicId },
    orderBy: { periodStart: "asc" },
    take: 12,
  });
}
