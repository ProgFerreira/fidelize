import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { OnboardingStepCode } from "@/generated/prisma/client";

export const ONBOARDING_STEPS: Array<{
  step: OnboardingStepCode;
  title: string;
  description: string;
}> = [
  { step: "CLINIC_IDENTITY", title: "Dados e identidade", description: "Nome, logo e contatos da clínica" },
  { step: "UNITS", title: "Unidades", description: "Cadastro das unidades" },
  { step: "PATIENT_IMPORT", title: "Importação de pacientes", description: "Base inicial de pacientes" },
  { step: "BENEFIT_MODE", title: "Modelo de benefício", description: "Cashback, pontos ou ambos" },
  { step: "CATEGORIES", title: "Categorias", description: "Níveis e progressão" },
  { step: "VALIDITY_LIMITS", title: "Validade e limites", description: "Regras financeiras" },
  { step: "COMMUNICATIONS", title: "Comunicações", description: "Canais e modelos de mensagem" },
  { step: "FIRST_CAMPAIGN", title: "Primeira campanha", description: "Campanha inicial" },
  { step: "STAFF_INVITE", title: "Funcionários", description: "Convite da equipe" },
  { step: "OPERATION_SIMULATION", title: "Simulação", description: "Operação de teste" },
  { step: "PUBLISH_CHECKLIST", title: "Publicação", description: "Checklist final" },
];

export async function ensureOnboarding(clinicId: string) {
  for (const item of ONBOARDING_STEPS) {
    await prisma.onboardingChecklist.upsert({
      where: { clinicId_step: { clinicId, step: item.step } },
      create: { clinicId, step: item.step, completed: false },
      update: {},
    });
  }
}

export async function autoDetectOnboarding(clinicId: string) {
  await ensureOnboarding(clinicId);
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  const units = await prisma.unit.count({ where: { clinicId } });
  const patients = await prisma.patient.count({ where: { clinicId } });
  const categories = await prisma.category.count({ where: { clinicId } });
  const settings = await prisma.setting.findUnique({
    where: { clinicId_key: { clinicId, key: "benefits" } },
  });
  const campaigns = await prisma.campaign.count({ where: { clinicId } });
  const users = await prisma.user.count({ where: { clinicId } });
  const appointments = await prisma.appointment.count({
    where: { clinicId, status: "CONFIRMED" },
  });
  const templates = await prisma.messageTemplate.count({ where: { clinicId } });

  const marks: Partial<Record<OnboardingStepCode, boolean>> = {
    CLINIC_IDENTITY: Boolean(clinic?.name && clinic?.email),
    UNITS: units > 0,
    PATIENT_IMPORT: patients > 0,
    BENEFIT_MODE: Boolean(settings),
    CATEGORIES: categories > 0,
    VALIDITY_LIMITS: Boolean(settings),
    COMMUNICATIONS: templates > 0,
    FIRST_CAMPAIGN: campaigns > 0,
    STAFF_INVITE: users > 1,
    OPERATION_SIMULATION: appointments > 0,
  };

  for (const [step, completed] of Object.entries(marks)) {
    if (!completed) continue;
    await prisma.onboardingChecklist.update({
      where: {
        clinicId_step: { clinicId, step: step as OnboardingStepCode },
      },
      data: { completed: true, completedAt: new Date() },
    });
  }
}

export async function setOnboardingStep(input: {
  clinicId: string;
  step: OnboardingStepCode;
  completed: boolean;
  actorId?: string;
  notes?: string;
}) {
  await ensureOnboarding(input.clinicId);
  const row = await prisma.onboardingChecklist.update({
    where: { clinicId_step: { clinicId: input.clinicId, step: input.step } },
    data: {
      completed: input.completed,
      completedAt: input.completed ? new Date() : null,
      notes: input.notes,
    },
  });
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "ONBOARDING_STEP",
    entityType: "OnboardingChecklist",
    entityId: row.id,
    afterData: { step: input.step, completed: input.completed },
  });
  return row;
}

export async function getOnboardingProgress(clinicId: string) {
  await autoDetectOnboarding(clinicId);
  const rows = await prisma.onboardingChecklist.findMany({
    where: { clinicId },
  });
  const byStep = Object.fromEntries(rows.map((r) => [r.step, r]));
  const steps = ONBOARDING_STEPS.map((s) => ({
    ...s,
    completed: Boolean(byStep[s.step]?.completed),
    notes: byStep[s.step]?.notes ?? null,
  }));
  const done = steps.filter((s) => s.completed).length;
  const percent = Math.round((done / steps.length) * 100);

  const publishReady = {
    regulation: Boolean(
      (await prisma.setting.findUnique({
        where: { clinicId_key: { clinicId, key: "regulation" } },
      })) ||
        (await prisma.patient.count({
          where: { clinicId, regulationConsent: true },
        })),
    ),
    financialRules: Boolean(
      await prisma.setting.findUnique({
        where: { clinicId_key: { clinicId, key: "benefits" } },
      }),
    ),
    identity: Boolean(
      (await prisma.clinic.findUnique({ where: { id: clinicId } }))?.name,
    ),
    authorizedUsers: (await prisma.user.count({ where: { clinicId } })) > 0,
    communicationChannel: (await prisma.messageTemplate.count({ where: { clinicId } })) > 0
      || (await prisma.featureModule.count({
        where: {
          clinicId,
          code: { in: ["WHATSAPP", "EMAIL", "SMS", "COMMUNICATIONS"] },
          enabled: true,
        },
      })) > 0,
    eligibleProcedures: (await prisma.procedure.count({
      where: { clinicId, eligible: true },
    })) > 0,
    reversalTested: (await prisma.ledgerEntry.count({
      where: { clinicId, type: { in: ["REVERSAL_CREDIT", "REVERSAL_REDEMPTION"] } },
    })) > 0,
  };

  return { steps, percent, pending: steps.filter((s) => !s.completed), publishReady };
}
