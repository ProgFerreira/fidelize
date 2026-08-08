import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import type { TagSource } from "@/generated/prisma/client";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const tagSchema = z.object({
  name: z.string().min(2).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#64748b"),
  description: z.string().max(500).optional().nullable(),
  autoRules: z.any().optional().nullable(),
});

export const SYSTEM_TAGS = [
  { name: "Novo paciente", slug: "novo-paciente", color: "#3b82f6" },
  { name: "Primeira visita", slug: "primeira-visita", color: "#06b6d4" },
  { name: "Frequente", slug: "frequente", color: "#22c55e" },
  { name: "VIP", slug: "vip", color: "#eab308" },
  { name: "Alto ticket", slug: "alto-ticket", color: "#f97316" },
  { name: "Aniversariante", slug: "aniversariante", color: "#ec4899" },
  { name: "Saldo próximo de expirar", slug: "saldo-expirando", color: "#ef4444" },
  { name: "Sem retorno 30 dias", slug: "sem-retorno-30", color: "#a855f7" },
  { name: "Sem retorno 60 dias", slug: "sem-retorno-60", color: "#8b5cf6" },
  { name: "Sem retorno 90 dias", slug: "sem-retorno-90", color: "#7c3aed" },
  { name: "Promotor", slug: "promotor", color: "#16a34a" },
  { name: "Neutro", slug: "neutro", color: "#64748b" },
  { name: "Detrator", slug: "detrator", color: "#dc2626" },
  { name: "Indicado", slug: "indicado", color: "#0ea5e9" },
  { name: "Indicador", slug: "indicador", color: "#0284c7" },
  { name: "Interesse em procedimento", slug: "interesse-procedimento", color: "#14b8a6" },
  { name: "Não deseja marketing", slug: "opt-out-marketing", color: "#475569" },
];

type AutoRule = {
  type?: string;
  daysSinceRegister?: number;
  maxAppointments?: number;
  minAppointments?: number;
  exactAppointments?: number;
  minSpend?: number;
  minBalance?: number;
  expiringDays?: number;
  inactiveDays?: number;
  birthMonth?: boolean;
  marketingOptOut?: boolean;
  npsClass?: "PROMOTER" | "PASSIVE" | "DETRACTOR";
  isReferrer?: boolean;
  isReferred?: boolean;
};

const DEFAULT_AUTO_RULES: Record<string, AutoRule> = {
  "novo-paciente": { daysSinceRegister: 30, maxAppointments: 0 },
  "primeira-visita": { exactAppointments: 1 },
  frequente: { minAppointments: 4 },
  vip: { minSpend: 5000 },
  "alto-ticket": { minSpend: 2000 },
  aniversariante: { birthMonth: true },
  "saldo-expirando": { expiringDays: 15 },
  "sem-retorno-30": { inactiveDays: 30 },
  "sem-retorno-60": { inactiveDays: 60 },
  "sem-retorno-90": { inactiveDays: 90 },
  "opt-out-marketing": { marketingOptOut: true },
};

export async function ensureSystemTags(clinicId: string) {
  for (const tag of SYSTEM_TAGS) {
    await prisma.customerTag.upsert({
      where: { clinicId_slug: { clinicId, slug: tag.slug } },
      create: { clinicId, ...tag, isSystem: true },
      update: { name: tag.name, color: tag.color },
    });
  }
}

export async function createTag(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof tagSchema>;
}) {
  await requireModule(input.clinicId, "TAGS");
  const data = tagSchema.parse(input.data);
  const slug = slugify(data.name);
  const tag = await prisma.customerTag.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      slug,
      color: data.color,
      description: data.description ?? null,
      autoRules: data.autoRules ?? undefined,
    },
  });
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "TAG_ASSIGN",
    entityType: "CustomerTag",
    entityId: tag.id,
    afterData: { name: tag.name, slug: tag.slug },
  });
  return tag;
}

export async function assignTag(input: {
  clinicId: string;
  patientId: string;
  tagId: string;
  source?: TagSource;
  actorId?: string;
}) {
  await requireModule(input.clinicId, "TAGS");
  const existing = await prisma.customerTagAssignment.findUnique({
    where: { tagId_patientId: { tagId: input.tagId, patientId: input.patientId } },
  });
  if (existing && !existing.removedAt) return existing;

  const assignment = existing
    ? await prisma.customerTagAssignment.update({
        where: { id: existing.id },
        data: {
          removedAt: null,
          source: input.source ?? "MANUAL",
          assignedAt: new Date(),
          assignedBy: input.actorId,
        },
      })
    : await prisma.customerTagAssignment.create({
        data: {
          clinicId: input.clinicId,
          tagId: input.tagId,
          patientId: input.patientId,
          source: input.source ?? "MANUAL",
          assignedBy: input.actorId,
        },
      });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "TAG_ASSIGN",
    entityType: "CustomerTagAssignment",
    entityId: assignment.id,
    afterData: { patientId: input.patientId, tagId: input.tagId },
  });
  return assignment;
}

export async function removeTag(input: {
  clinicId: string;
  patientId: string;
  tagId: string;
  actorId?: string;
}) {
  const assignment = await prisma.customerTagAssignment.findUnique({
    where: { tagId_patientId: { tagId: input.tagId, patientId: input.patientId } },
  });
  if (!assignment || assignment.removedAt) return null;

  const updated = await prisma.customerTagAssignment.update({
    where: { id: assignment.id },
    data: { removedAt: new Date() },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "TAG_REMOVE",
    entityType: "CustomerTagAssignment",
    entityId: updated.id,
    afterData: { patientId: input.patientId, tagId: input.tagId },
  });
  return updated;
}

export async function bulkAssignTag(input: {
  clinicId: string;
  tagId: string;
  patientIds: string[];
  actorId?: string;
}) {
  const results = [];
  for (const patientId of input.patientIds) {
    results.push(
      await assignTag({
        clinicId: input.clinicId,
        patientId,
        tagId: input.tagId,
        actorId: input.actorId,
        source: "MANUAL",
      }),
    );
  }
  return results;
}

export async function listTags(clinicId: string) {
  await ensureSystemTags(clinicId);
  return prisma.customerTag.findMany({
    where: { clinicId, active: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          assignments: { where: { removedAt: null } },
        },
      },
    },
  });
}

function ruleMatches(
  rule: AutoRule,
  ctx: {
    daysSinceRegister: number;
    appointments: number;
    spend: number;
    balance: number;
    daysInactive: number;
    hasExpiring: boolean;
    birthMonth: boolean;
    marketingOptOut: boolean;
    npsClass: string | null;
    isReferrer: boolean;
    isReferred: boolean;
  },
) {
  if (rule.daysSinceRegister != null && ctx.daysSinceRegister > rule.daysSinceRegister) {
    return false;
  }
  if (rule.maxAppointments != null && ctx.appointments > rule.maxAppointments) return false;
  if (rule.minAppointments != null && ctx.appointments < rule.minAppointments) return false;
  if (rule.exactAppointments != null && ctx.appointments !== rule.exactAppointments) {
    return false;
  }
  if (rule.minSpend != null && ctx.spend < rule.minSpend) return false;
  if (rule.minBalance != null && ctx.balance < rule.minBalance) return false;
  if (rule.inactiveDays != null && ctx.daysInactive < rule.inactiveDays) return false;
  if (rule.expiringDays != null && !ctx.hasExpiring) return false;
  if (rule.birthMonth && !ctx.birthMonth) return false;
  if (rule.marketingOptOut && !ctx.marketingOptOut) return false;
  if (rule.npsClass && ctx.npsClass !== rule.npsClass) return false;
  if (rule.isReferrer && !ctx.isReferrer) return false;
  if (rule.isReferred && !ctx.isReferred) return false;
  return true;
}

/** Aplica/remove etiquetas automáticas conforme condições atuais. */
export async function syncAutomaticTags(clinicId: string, limit = 200) {
  await requireModule(clinicId, "TAGS");
  await ensureSystemTags(clinicId);

  const tags = await prisma.customerTag.findMany({
    where: { clinicId, active: true },
  });

  const patients = await prisma.patient.findMany({
    where: { clinicId, status: { in: ["ACTIVE", "INACTIVE"] } },
    include: {
      wallets: true,
      appointments: {
        where: { status: "CONFIRMED" },
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
      surveyResponses: {
        where: { respondedAt: { not: null }, score: { gte: 0 } },
        orderBy: { respondedAt: "desc" },
        take: 1,
      },
      referralsMade: {
        where: { status: { in: ["BENEFIT_GRANTED", "CONVERTED", "LEAD"] } },
        take: 1,
      },
      referralsReceived: {
        where: { status: { in: ["BENEFIT_GRANTED", "CONVERTED", "LEAD"] } },
        take: 1,
      },
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const now = Date.now();
  const in15 = new Date(now + 15 * 86400000);
  let changed = 0;

  for (const patient of patients) {
    const wallet = patient.wallets[0];
    const lastAppt = patient.appointments[0]?.occurredAt ?? patient.registeredAt;
    const daysInactive = Math.floor((now - lastAppt.getTime()) / 86400000);
    const daysSinceRegister = Math.floor(
      (now - patient.registeredAt.getTime()) / 86400000,
    );
    const month = new Date().getUTCMonth();
    const birthMonth = Boolean(
      patient.birthDate && patient.birthDate.getUTCMonth() === month,
    );

    let hasExpiring = false;
    if (wallet) {
      const lot = await prisma.creditLot.findFirst({
        where: {
          clinicId,
          walletId: wallet.id,
          status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
          expiresAt: { not: null, gte: new Date(), lte: in15 },
        },
      });
      hasExpiring = Boolean(lot);
    }

    const ctx = {
      daysSinceRegister,
      appointments: wallet?.appointmentCount ?? 0,
      spend: Number(wallet?.annualSpend ?? 0),
      balance: Number(wallet?.availableBalance ?? 0),
      daysInactive,
      hasExpiring,
      birthMonth,
      marketingOptOut: !patient.marketingConsent,
      npsClass: patient.surveyResponses[0]?.classification ?? null,
      isReferrer: patient.referralsMade.length > 0,
      isReferred: patient.referralsReceived.length > 0,
    };

    for (const tag of tags) {
      const custom = tag.autoRules as AutoRule | null;
      const fallback = tag.isSystem ? DEFAULT_AUTO_RULES[tag.slug] : null;
      const rule = custom && Object.keys(custom).length ? custom : fallback;
      if (!rule) continue;

      // NPS system tags: only apply, never auto-remove via inactivity rules
      const shouldHave = ruleMatches(rule, ctx);
      const assignment = await prisma.customerTagAssignment.findUnique({
        where: {
          tagId_patientId: { tagId: tag.id, patientId: patient.id },
        },
      });
      const active = Boolean(assignment && !assignment.removedAt);

      if (shouldHave && !active) {
        await assignTag({
          clinicId,
          patientId: patient.id,
          tagId: tag.id,
          source: "AUTOMATIC",
        });
        changed += 1;
      } else if (
        !shouldHave &&
        active &&
        assignment?.source === "AUTOMATIC"
      ) {
        await removeTag({
          clinicId,
          patientId: patient.id,
          tagId: tag.id,
        });
        changed += 1;
      }
    }
  }

  return { scanned: patients.length, changed };
}

export async function patientsByTagIds(
  clinicId: string,
  tagIds: string[],
  mode: "AND" | "OR" = "AND",
) {
  if (!tagIds.length) {
    return prisma.patient.findMany({
      where: { clinicId },
      take: 100,
      orderBy: { fullName: "asc" },
    });
  }
  if (mode === "OR") {
    return prisma.patient.findMany({
      where: {
        clinicId,
        tagAssignments: {
          some: { tagId: { in: tagIds }, removedAt: null },
        },
      },
      take: 200,
      orderBy: { fullName: "asc" },
    });
  }
  const patients = await prisma.patient.findMany({
    where: {
      clinicId,
      AND: tagIds.map((tagId) => ({
        tagAssignments: { some: { tagId, removedAt: null } },
      })),
    },
    take: 200,
    orderBy: { fullName: "asc" },
  });
  return patients;
}
