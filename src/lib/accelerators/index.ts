import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { money } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export const acceleratorSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  multiplierPoints: z.coerce.number().optional().nullable(),
  extraCashbackPct: z.coerce.number().optional().nullable(),
  bonusFixed: z.coerce.number().optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  hours: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional()
    .nullable(),
  procedureIds: z.array(z.string()).optional().nullable(),
  unitIds: z.array(z.string()).optional().nullable(),
  categoryIds: z.array(z.string()).optional().nullable(),
  limitPerPatient: z.coerce.number().int().optional().nullable(),
  financialCap: z.coerce.number().optional().nullable(),
  priority: z.coerce.number().int().default(0),
  stackable: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function createAccelerator(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof acceleratorSchema>;
}) {
  await requireModule(input.clinicId, "ACCELERATORS");
  const data = acceleratorSchema.parse(input.data);
  if (data.endsAt <= data.startsAt) throw new Error("Vigência inválida");

  const maxCostEstimate = estimateMaxCost(data);

  const rule = await prisma.acceleratorRule.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      description: data.description ?? null,
      multiplierPoints:
        data.multiplierPoints != null ? String(data.multiplierPoints) : null,
      extraCashbackPct:
        data.extraCashbackPct != null ? String(data.extraCashbackPct) : null,
      bonusFixed: data.bonusFixed != null ? String(data.bonusFixed) : null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      daysOfWeek: (data.daysOfWeek ?? undefined) as Prisma.InputJsonValue | undefined,
      hours: (data.hours ?? undefined) as Prisma.InputJsonValue | undefined,
      procedureIds: (data.procedureIds ?? undefined) as Prisma.InputJsonValue | undefined,
      unitIds: (data.unitIds ?? undefined) as Prisma.InputJsonValue | undefined,
      categoryIds: (data.categoryIds ?? undefined) as Prisma.InputJsonValue | undefined,
      limitPerPatient: data.limitPerPatient ?? null,
      financialCap: data.financialCap != null ? String(data.financialCap) : null,
      priority: data.priority,
      stackable: data.stackable,
      active: data.active,
    },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "ACCELERATOR_CHANGE",
    entityType: "AcceleratorRule",
    entityId: rule.id,
    afterData: { name: rule.name, maxCostEstimate },
  });

  return { rule, maxCostEstimate };
}

function estimateMaxCost(data: z.infer<typeof acceleratorSchema>) {
  if (data.financialCap != null) return data.financialCap;
  if (data.bonusFixed != null && data.limitPerPatient != null) {
    return data.bonusFixed * Math.max(data.limitPerPatient, 1) * 100;
  }
  return null;
}

function inHourWindow(hours: { start?: string; end?: string } | null, at: Date) {
  if (!hours?.start || !hours?.end) return true;
  const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return hhmm >= hours.start && hhmm <= hours.end;
}

export async function activeAccelerators(
  clinicId: string,
  at = new Date(),
  filters?: {
    procedureId?: string | null;
    unitId?: string | null;
    categoryId?: string | null;
  },
) {
  const rules = await prisma.acceleratorRule.findMany({
    where: {
      clinicId,
      active: true,
      startsAt: { lte: at },
      endsAt: { gte: at },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  const dow = at.getDay();
  return rules.filter((rule) => {
    const days = rule.daysOfWeek as number[] | null;
    if (days && days.length > 0 && !days.includes(dow)) return false;
    const hours = rule.hours as { start?: string; end?: string } | null;
    if (!inHourWindow(hours, at)) return false;
    const procedures = rule.procedureIds as string[] | null;
    if (
      procedures?.length &&
      filters?.procedureId &&
      !procedures.includes(filters.procedureId)
    ) {
      return false;
    }
    const units = rule.unitIds as string[] | null;
    if (units?.length && filters?.unitId && !units.includes(filters.unitId)) {
      return false;
    }
    const categories = rule.categoryIds as string[] | null;
    if (
      categories?.length &&
      filters?.categoryId &&
      !categories.includes(filters.categoryId)
    ) {
      return false;
    }
    return true;
  });
}

export async function applyAcceleratorBonus(input: {
  clinicId: string;
  baseCashbackPct: number;
  basePoints: number;
  paidAmount: number;
  procedureId?: string | null;
  unitId?: string | null;
  categoryId?: string | null;
}) {
  const rules = await activeAccelerators(input.clinicId, new Date(), {
    procedureId: input.procedureId,
    unitId: input.unitId,
    categoryId: input.categoryId,
  });
  if (!rules.length) {
    return {
      cashbackPct: input.baseCashbackPct,
      points: input.basePoints,
      bonusFixedAmount: 0,
      applied: [] as string[],
    };
  }

  let cashbackPct = input.baseCashbackPct;
  let points = input.basePoints;
  let bonusFixedAmount = 0;
  const applied: string[] = [];

  for (const rule of rules) {
    if (rule.financialCap != null) {
      const spent = money(rule.spentAmount);
      const cap = money(rule.financialCap);
      if (spent.gte(cap)) continue;
    }
    if (rule.extraCashbackPct) {
      cashbackPct += Number(rule.extraCashbackPct);
    }
    if (rule.multiplierPoints) {
      points = Math.round(points * Number(rule.multiplierPoints));
    }
    if (rule.bonusFixed) {
      bonusFixedAmount += Number(rule.bonusFixed);
    }
    applied.push(rule.id);
    if (!rule.stackable) break;
  }

  return { cashbackPct, points, bonusFixedAmount, applied };
}

export async function markAcceleratorSpend(input: {
  clinicId: string;
  ruleIds: string[];
  amount: number;
}) {
  for (const id of input.ruleIds) {
    const rule = await prisma.acceleratorRule.findFirst({
      where: { id, clinicId: input.clinicId },
    });
    if (!rule) continue;
    await prisma.acceleratorRule.update({
      where: { id },
      data: {
        spentAmount: money(rule.spentAmount).plus(input.amount).toFixed(4),
      },
    });
  }
}

export async function listAccelerators(clinicId: string) {
  return prisma.acceleratorRule.findMany({
    where: { clinicId },
    orderBy: [{ active: "desc" }, { priority: "desc" }],
  });
}
