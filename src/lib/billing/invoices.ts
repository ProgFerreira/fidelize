import { prisma } from "@/lib/db";
import { getPlan, type PlanCode } from "@/lib/billing/plans";
import { moneyToString } from "@/lib/money";

export async function issuePlanInvoice(params: {
  organizationId: string;
  plan: PlanCode;
  notes?: string;
}) {
  const catalog = getPlan(params.plan);
  const amount = catalog.monthlyPriceBrl ?? 0;
  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const { semOrganizacao } = await import("@/lib/tenant");
  return semOrganizacao(() =>
    prisma.organizationInvoice.create({
      data: {
        organizationId: params.organizationId,
        planCode: catalog.code,
        amount: moneyToString(amount),
        status: amount > 0 ? "PENDING" : "PAID",
        paidAt: amount > 0 ? null : new Date(),
        periodStart,
        periodEnd,
        notes: params.notes ?? `Assinatura ${catalog.name}`,
      },
    }),
  );
}

export async function listOrganizationInvoices(organizationId: string) {
  const { semOrganizacao } = await import("@/lib/tenant");
  return semOrganizacao(() =>
    prisma.organizationInvoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
  );
}

export async function markInvoicePaid(params: {
  organizationId: string;
  invoiceId: string;
}) {
  const { semOrganizacao } = await import("@/lib/tenant");
  return semOrganizacao(() =>
    prisma.organizationInvoice.updateMany({
      where: { id: params.invoiceId, organizationId: params.organizationId },
      data: { status: "PAID", paidAt: new Date() },
    }),
  );
}

export async function getPlanUsage(organizationId: string) {
  const { getOrganizationPlan } = await import("@/lib/billing/enforce");
  const plan = await getOrganizationPlan(organizationId);
  const [users, clinics, patients] = await Promise.all([
    prisma.user.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    prisma.clinic.count({
      where: { organizationId, active: true },
    }),
    prisma.patient.count({
      where: {
        clinic: { organizationId },
        status: { not: "BLOCKED" },
      },
    }),
  ]);
  return {
    plan,
    usage: { users, clinics, patients },
  };
}

export async function suspendExpiredTrials() {
  const { semOrganizacao } = await import("@/lib/tenant");
  return semOrganizacao(() =>
    prisma.organization.updateMany({
      where: {
        plan: "trial",
        active: true,
        trialEndsAt: { lt: new Date() },
        suspendedAt: null,
      },
      data: {
        suspendedAt: new Date(),
        suspensionReason: "Trial encerrado",
      },
    }),
  );
}
