import { prisma } from "@/lib/db";
import { getPlan, normalizePlanCode, type PlanCode } from "@/lib/billing/plans";
import { setModuleEnabled, ensureModulesForClinic } from "@/lib/modules";

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export async function getOrganizationPlan(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      plan: true,
      maxUsers: true,
      maxClinics: true,
      maxPatients: true,
      trialEndsAt: true,
      active: true,
      suspendedAt: true,
    },
  });
  if (!org) throw new Error("Organização não encontrada");
  const catalog = getPlan(org.plan);
  return {
    ...org,
    planCode: catalog.code,
    catalog,
    limits: {
      maxUsers: org.maxUsers ?? catalog.maxUsers,
      maxClinics: org.maxClinics ?? catalog.maxClinics,
      maxPatients: org.maxPatients ?? catalog.maxPatients,
    },
  };
}

export async function assertWithinPlanLimits(input: {
  organizationId: string;
  kind: "users" | "clinics" | "patients";
  clinicId?: string;
}) {
  const plan = await getOrganizationPlan(input.organizationId);
  if (!plan.active || plan.suspendedAt) {
    throw new PlanLimitError("Organização suspensa. Regularize o plano.");
  }
  if (
    plan.planCode === "trial" &&
    plan.trialEndsAt &&
    plan.trialEndsAt.getTime() < Date.now()
  ) {
    throw new PlanLimitError("Período trial encerrado. Escolha um combo Start/Pro/Vip.");
  }

  if (input.kind === "users" && plan.limits.maxUsers != null) {
    const count = await prisma.user.count({
      where: { organizationId: input.organizationId, status: "ACTIVE" },
    });
    if (count >= plan.limits.maxUsers) {
      throw new PlanLimitError(
        `Limite do plano ${plan.catalog.name}: ${plan.limits.maxUsers} usuários.`,
      );
    }
  }

  if (input.kind === "clinics" && plan.limits.maxClinics != null) {
    const count = await prisma.clinic.count({
      where: { organizationId: input.organizationId, active: true },
    });
    if (count >= plan.limits.maxClinics) {
      throw new PlanLimitError(
        `Limite do plano ${plan.catalog.name}: ${plan.limits.maxClinics} clínicas.`,
      );
    }
  }

  if (input.kind === "patients" && plan.limits.maxPatients != null) {
    const count = await prisma.patient.count({
      where: {
        clinic: { organizationId: input.organizationId },
        status: { not: "BLOCKED" },
      },
    });
    if (count >= plan.limits.maxPatients) {
      throw new PlanLimitError(
        `Limite do plano ${plan.catalog.name}: ${plan.limits.maxPatients} pacientes.`,
      );
    }
  }
}

export async function applyPlanToOrganization(input: {
  organizationId: string;
  plan: PlanCode;
  actorId?: string;
}) {
  const catalog = getPlan(input.plan);
  const org = await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      plan: catalog.code,
      maxUsers: catalog.maxUsers,
      maxClinics: catalog.maxClinics,
      maxPatients: catalog.maxPatients,
      trialEndsAt:
        catalog.code === "trial"
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          : null,
      suspendedAt: null,
      suspensionReason: null,
      active: true,
    },
  });

  const clinics = await prisma.clinic.findMany({
    where: { organizationId: input.organizationId, active: true },
    select: { id: true },
  });

  for (const clinic of clinics) {
    await ensureModulesForClinic(clinic.id);
    for (const mod of catalog.modules) {
      await setModuleEnabled({
        clinicId: clinic.id,
        code: mod,
        enabled: true,
        actorId: input.actorId,
      });
    }
  }

  return { organization: org, plan: catalog };
}

export function parsePlanCode(value: string): PlanCode {
  return normalizePlanCode(value);
}
