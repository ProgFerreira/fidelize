import { prisma } from "@/lib/db";
import { listHighRiskPatients } from "@/lib/predictive";

/**
 * Visão "Loyalty 360 clínico": pós-consulta → NPS → indicação → recuperação.
 */
export async function getLoyalty360Snapshot(clinicId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    confirmedAppointments,
    openSurveys,
    npsResponses,
    referralsPending,
    referralsConverted,
    recoveryOpen,
    highRisk,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { clinicId, status: "CONFIRMED", occurredAt: { gte: since } },
    }),
    prisma.surveyResponse.count({
      where: {
        clinicId,
        score: -1,
        createdAt: { gte: since },
      },
    }),
    prisma.surveyResponse.findMany({
      where: {
        clinicId,
        createdAt: { gte: since },
        respondedAt: { not: null },
        score: { gte: 0 },
      },
      select: { score: true },
      take: 500,
    }),
    prisma.referral.count({
      where: {
        clinicId,
        status: {
          in: ["LEAD", "LINK_OPENED", "SIGNUP_STARTED", "APPOINTMENT_SCHEDULED"],
        },
      },
    }),
    prisma.referral.count({
      where: {
        clinicId,
        status: { in: ["CONVERTED", "BENEFIT_GRANTED"] },
        updatedAt: { gte: since },
      },
    }),
    prisma.recoveryCase.count({
      where: {
        clinicId,
        status: { in: ["ATTENTION", "RISK", "INACTIVE"] },
      },
    }),
    listHighRiskPatients(clinicId, 10).catch(() => []),
  ]);

  const scores = npsResponses.map((r) => r.score);
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const nps =
    scores.length > 0
      ? Math.round(((promoters - detractors) / scores.length) * 100)
      : null;

  return {
    windowDays: 30,
    pipeline: [
      {
        id: "appointments",
        label: "Atendimentos confirmados",
        value: confirmedAppointments,
        href: "/recepcao",
      },
      {
        id: "nps_pending",
        label: "NPS aguardando resposta",
        value: openSurveys,
        href: "/nps",
      },
      {
        id: "nps_score",
        label: "NPS (30 dias)",
        value: nps == null ? "—" : nps,
        href: "/nps",
      },
      {
        id: "referrals_funnel",
        label: "Indicações em aberto",
        value: referralsPending,
        href: "/indicacoes",
      },
      {
        id: "referrals_converted",
        label: "Indicações convertidas",
        value: referralsConverted,
        href: "/indicacoes",
      },
      {
        id: "recovery",
        label: "Recuperação ativa",
        value: recoveryOpen,
        href: "/recuperacao",
      },
    ],
    highRiskPatients: highRisk,
  };
}
