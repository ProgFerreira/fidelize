import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { assignTag } from "@/lib/tags";
import { runAutomationsForTrigger } from "@/lib/automations";
import type { SurveyResponseClass } from "@/generated/prisma/client";

export function classifyNps(score: number): SurveyResponseClass {
  if (score <= 6) return "DETRACTOR";
  if (score <= 8) return "PASSIVE";
  return "PROMOTER";
}

export async function ensureDefaultSurvey(clinicId: string) {
  const existing = await prisma.satisfactionSurvey.findFirst({
    where: { clinicId, active: true },
  });
  if (existing) return existing;
  return prisma.satisfactionSurvey.create({
    data: {
      clinicId,
      name: "NPS pós-atendimento",
      validityDays: 7,
    },
  });
}

export async function createSurveyInvite(input: {
  clinicId: string;
  patientId: string;
  appointmentId: string;
}) {
  await requireModule(input.clinicId, "NPS");
  const survey = await ensureDefaultSurvey(input.clinicId);
  const existing = await prisma.surveyResponse.findUnique({
    where: {
      surveyId_appointmentId: {
        surveyId: survey.id,
        appointmentId: input.appointmentId,
      },
    },
  });
  if (existing) return existing;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + survey.validityDays);

  return prisma.surveyResponse.create({
    data: {
      clinicId: input.clinicId,
      surveyId: survey.id,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      score: -1,
      classification: "PASSIVE",
      token: randomBytes(16).toString("hex"),
      expiresAt,
    },
  });
}

export const npsResponseSchema = z.object({
  token: z.string().min(10),
  score: z.coerce.number().int().min(0).max(10),
  comment: z.string().max(2000).optional().nullable(),
});

export async function submitNpsResponse(data: z.infer<typeof npsResponseSchema>) {
  const parsed = npsResponseSchema.parse(data);
  const row = await prisma.surveyResponse.findUnique({
    where: { token: parsed.token },
    include: { survey: true },
  });
  if (!row) throw new Error("Pesquisa inválida");
  if (row.respondedAt) throw new Error("Pesquisa já respondida");
  if (row.expiresAt < new Date()) throw new Error("Pesquisa expirada");

  const classification = classifyNps(parsed.score);
  const updated = await prisma.surveyResponse.update({
    where: { id: row.id },
    data: {
      score: parsed.score,
      classification,
      comment: parsed.comment ?? null,
      respondedAt: new Date(),
    },
  });

  const slug =
    classification === "PROMOTER"
      ? "promotor"
      : classification === "DETRACTOR"
        ? "detrator"
        : "neutro";
  const tag = await prisma.customerTag.findFirst({
    where: { clinicId: row.clinicId, slug },
  });
  if (tag) {
    await assignTag({
      clinicId: row.clinicId,
      patientId: row.patientId,
      tagId: tag.id,
      source: "AUTOMATIC",
    });
  }

  if (classification === "DETRACTOR") {
    await prisma.recoveryCase.create({
      data: {
        clinicId: row.clinicId,
        patientId: row.patientId,
        status: "ATTENTION",
        notes: `NPS detrator (${parsed.score}): ${parsed.comment ?? "sem comentário"}`,
        ruleConfig: { source: "NPS", surveyResponseId: row.id },
      },
    });
    await prisma.surveyResponse.update({
      where: { id: row.id },
      data: { recoveryTaskCreated: true },
    });
  }

  let referralLink: string | null = null;
  if (classification === "PROMOTER") {
    try {
      const { ensureReferralLink, referralShareUrl } = await import("@/lib/referrals");
      const { isModuleEnabled } = await import("@/lib/modules");
      if (await isModuleEnabled(row.clinicId, "REFERRAL")) {
        const { referral } = await ensureReferralLink({
          clinicId: row.clinicId,
          patientId: row.patientId,
        });
        referralLink = referralShareUrl(referral.shortCode);
      }
    } catch {
      // indicação opcional
    }
  }

  await runAutomationsForTrigger({
    clinicId: row.clinicId,
    trigger: "NPS_RESPONDED",
    patientId: row.patientId,
    triggerRef: row.id,
    context: {
      variables: referralLink ? { link_indicacao: referralLink } : undefined,
    },
  });

  await writeAuditLog({
    clinicId: row.clinicId,
    action: "NPS_RESPONSE",
    entityType: "SurveyResponse",
    entityId: row.id,
    afterData: { score: parsed.score, classification, referralLink },
  });

  return { ...updated, referralLink };
}

export async function npsDashboard(clinicId: string) {
  const responses = await prisma.surveyResponse.findMany({
    where: {
      clinicId,
      respondedAt: { not: null },
      score: { gte: 0 },
    },
    orderBy: { respondedAt: "desc" },
    take: 500,
  });

  const appointmentIds = responses
    .map((r) => r.appointmentId)
    .filter((id): id is string => Boolean(id));
  const appointments = appointmentIds.length
    ? await prisma.appointment.findMany({
        where: { id: { in: appointmentIds } },
        select: {
          id: true,
          professionalName: true,
          procedure: { select: { name: true } },
          unit: { select: { name: true } },
        },
      })
    : [];
  const apptById = Object.fromEntries(appointments.map((a) => [a.id, a]));

  const total = responses.length;
  const promoters = responses.filter((r) => r.classification === "PROMOTER").length;
  const detractors = responses.filter((r) => r.classification === "DETRACTOR").length;
  const passives = responses.filter((r) => r.classification === "PASSIVE").length;
  const nps = total ? Math.round(((promoters - detractors) / total) * 100) : 0;
  const pendingRecovery = await prisma.recoveryCase.count({
    where: {
      clinicId,
      status: { in: ["ATTENTION", "RISK"] },
      notes: { contains: "NPS" },
    },
  });
  const invites = await prisma.surveyResponse.count({ where: { clinicId } });
  const responseRate = invites ? Math.round((total / invites) * 100) : 0;

  const byUnit = new Map<string, { n: number; promoters: number; detractors: number }>();
  const byProfessional = new Map<string, { n: number; promoters: number; detractors: number }>();
  const byProcedure = new Map<string, { n: number; promoters: number; detractors: number }>();
  const monthly = new Map<string, { n: number; promoters: number; detractors: number }>();

  for (const r of responses) {
    const appt = r.appointmentId ? apptById[r.appointmentId] : undefined;
    const bump = (
      map: Map<string, { n: number; promoters: number; detractors: number }>,
      key: string,
    ) => {
      const cur = map.get(key) ?? { n: 0, promoters: 0, detractors: 0 };
      cur.n += 1;
      if (r.classification === "PROMOTER") cur.promoters += 1;
      if (r.classification === "DETRACTOR") cur.detractors += 1;
      map.set(key, cur);
    };
    bump(byUnit, appt?.unit?.name ?? "Sem unidade");
    bump(byProfessional, appt?.professionalName ?? "Não informado");
    bump(byProcedure, appt?.procedure?.name ?? "Geral");
    const monthKey = (r.respondedAt ?? r.createdAt).toISOString().slice(0, 7);
    bump(monthly, monthKey);
  }

  const toNps = (v: { n: number; promoters: number; detractors: number }) =>
    v.n ? Math.round(((v.promoters - v.detractors) / v.n) * 100) : 0;

  return {
    nps,
    total,
    promoters,
    passives,
    detractors,
    responseRate,
    pendingRecovery,
    recent: responses.slice(0, 20),
    byUnit: [...byUnit.entries()].map(([name, v]) => ({ name, nps: toNps(v), total: v.n })),
    byProfessional: [...byProfessional.entries()].map(([name, v]) => ({
      name,
      nps: toNps(v),
      total: v.n,
    })),
    byProcedure: [...byProcedure.entries()].map(([name, v]) => ({
      name,
      nps: toNps(v),
      total: v.n,
    })),
    monthly: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, nps: toNps(v), total: v.n })),
    commentThemes: responses.map((r) => r.comment).filter(Boolean).slice(0, 30),
  };
}
