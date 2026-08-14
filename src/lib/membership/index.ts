import { z } from "zod";
import { prisma } from "@/lib/db";
import { organizacaoAtual } from "@/lib/tenant";
import { moneyToString } from "@/lib/money";

export const membershipPlanSchema = z.object({
  name: z.string().trim().min(2).max(80),
  monthlyPrice: z.coerce.number().min(0),
  extraCashbackPct: z.coerce.number().min(0).max(50).default(0),
  courtesyNote: z.string().trim().max(500).optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export async function listMembershipPlans(clinicId: string, activeOnly = false) {
  return prisma.membershipPlan.findMany({
    where: { clinicId, ...(activeOnly ? { active: true } : {}) },
    orderBy: { monthlyPrice: "asc" },
  });
}

export async function upsertMembershipPlan(params: {
  clinicId: string;
  id?: string;
  data: z.infer<typeof membershipPlanSchema>;
}) {
  const data = membershipPlanSchema.parse(params.data);
  const payload = {
    name: data.name,
    monthlyPrice: moneyToString(data.monthlyPrice),
    extraCashbackPct: moneyToString(data.extraCashbackPct),
    courtesyNote: data.courtesyNote || null,
    active: data.active,
  };
  if (params.id) {
    const existing = await prisma.membershipPlan.findFirst({
      where: { id: params.id, clinicId: params.clinicId },
    });
    if (!existing) throw new Error("Plano não encontrado");
    return prisma.membershipPlan.update({ where: { id: existing.id }, data: payload });
  }
  return prisma.membershipPlan.create({
    data: {
      organizationId: organizacaoAtual(),
      clinicId: params.clinicId,
      ...payload,
    },
  });
}

export async function getActiveMembership(clinicId: string, patientId: string) {
  const now = new Date();
  const row = await prisma.patientMembership.findFirst({
    where: {
      clinicId,
      patientId,
      status: "ACTIVE",
      renewsAt: { gt: now },
    },
    include: { plan: true },
    orderBy: { renewsAt: "desc" },
  });
  return row;
}

export async function subscribeMembership(params: {
  clinicId: string;
  patientId: string;
  planId: string;
  paidMethod: "PIX" | "DINHEIRO" | "CORTESIA";
  confirmPayment: boolean;
}) {
  const plan = await prisma.membershipPlan.findFirst({
    where: { id: params.planId, clinicId: params.clinicId, active: true },
  });
  if (!plan) throw new Error("Plano do clube não encontrado");

  await prisma.patientMembership.updateMany({
    where: { clinicId: params.clinicId, patientId: params.patientId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);
  const status = params.confirmPayment ? "ACTIVE" : "PENDING";

  return prisma.patientMembership.create({
    data: {
      organizationId: organizacaoAtual(),
      clinicId: params.clinicId,
      patientId: params.patientId,
      planId: plan.id,
      status,
      renewsAt,
      paidMethod: params.paidMethod,
      paidAmount: plan.monthlyPrice,
    },
    include: { plan: true, patient: { select: { fullName: true } } },
  });
}

export async function confirmMembershipPayment(params: {
  clinicId: string;
  membershipId: string;
}) {
  const row = await prisma.patientMembership.findFirst({
    where: { id: params.membershipId, clinicId: params.clinicId },
  });
  if (!row) throw new Error("Assinatura não encontrada");
  return prisma.patientMembership.update({
    where: { id: row.id },
    data: { status: "ACTIVE" },
    include: { plan: true, patient: { select: { fullName: true } } },
  });
}

export async function listClinicMemberships(clinicId: string) {
  return prisma.patientMembership.findMany({
    where: { clinicId },
    include: {
      plan: true,
      patient: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function expireMemberships(clinicId: string) {
  return prisma.patientMembership.updateMany({
    where: { clinicId, status: "ACTIVE", renewsAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
}
