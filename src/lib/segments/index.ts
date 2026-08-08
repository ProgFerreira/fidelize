import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/modules";
import { writeAuditLog } from "@/lib/audit";
import { money } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export const segmentRuleSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "contains",
    "between",
  ]),
  value: z.any(),
  logicGroup: z.string().default("AND"),
});

export const segmentSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  rules: z.array(segmentRuleSchema).min(1),
});

type Rule = z.infer<typeof segmentRuleSchema>;

function buildPatientWhere(
  clinicId: string,
  rules: Rule[],
): Prisma.PatientWhereInput {
  const and: Prisma.PatientWhereInput[] = [{ clinicId }];

  for (const rule of rules) {
    switch (rule.field) {
      case "unitId":
        and.push({ unitId: String(rule.value) });
        break;
      case "status":
        and.push({ status: rule.value });
        break;
      case "marketingConsent":
        and.push({ marketingConsent: Boolean(rule.value) });
        break;
      case "birthMonth": {
        and.push({ birthDate: { not: null } });
        break;
      }
      case "tag":
      case "tagId":
        and.push({
          tagAssignments: {
            some: {
              tagId: String(rule.value),
              removedAt: null,
            },
          },
        });
        break;
      case "tagSlug":
        and.push({
          tagAssignments: {
            some: {
              removedAt: null,
              tag: { slug: String(rule.value) },
            },
          },
        });
        break;
      case "minSpend":
      case "totalSpend":
        and.push({
          wallets: { some: { annualSpend: { gte: String(rule.value) } } },
        });
        break;
      case "minPoints":
      case "points":
        and.push({
          wallets: { some: { pointsBalance: { gte: Number(rule.value) } } },
        });
        break;
      case "minBalance":
      case "balance":
        and.push({
          wallets: {
            some: { availableBalance: { gte: String(rule.value) } },
          },
        });
        break;
      case "minAppointments":
      case "appointments":
        and.push({
          wallets: {
            some: { appointmentCount: { gte: Number(rule.value) } },
          },
        });
        break;
      case "categoryId":
        and.push({
          wallets: { some: { categoryId: String(rule.value) } },
        });
        break;
      case "origin":
      case "externalCode":
        and.push({
          externalCode: rule.operator === "eq" ? String(rule.value) : undefined,
        });
        break;
      case "npsClass":
        and.push({
          surveyResponses: {
            some: {
              classification: rule.value,
              respondedAt: { not: null },
            },
          },
        });
        break;
      case "campaignId":
        and.push({
          campaignUses: { some: { campaignId: String(rule.value) } },
        });
        break;
      case "hasValidChannel":
        and.push({
          OR: [
            { phone: { not: "" } },
            { email: { not: null } },
          ],
        });
        break;
      case "lastAppointmentBefore":
        and.push({
          appointments: {
            none: {
              status: "CONFIRMED",
              occurredAt: { gte: new Date(String(rule.value)) },
            },
          },
        });
        break;
      case "lastAppointmentAfter":
        and.push({
          appointments: {
            some: {
              status: "CONFIRMED",
              occurredAt: { gte: new Date(String(rule.value)) },
            },
          },
        });
        break;
      case "ageMin":
      case "ageMax": {
        // filtrado em memória
        and.push({ birthDate: { not: null } });
        break;
      }
      case "balanceExpiringDays":
        and.push({
          wallets: {
            some: {
              creditLots: {
                some: {
                  status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
                  expiresAt: {
                    lte: new Date(
                      Date.now() + Number(rule.value) * 86400000,
                    ),
                    gte: new Date(),
                  },
                },
              },
            },
          },
        });
        break;
      default:
        break;
    }
  }

  return { AND: and };
}

function ageYears(birth: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export async function createSegment(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof segmentSchema>;
}) {
  await requireModule(input.clinicId, "SEGMENTS");
  const data = segmentSchema.parse(input.data);
  const segment = await prisma.dynamicSegment.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      description: data.description ?? null,
      rules: {
        create: data.rules.map((rule, index) => ({
          field: rule.field,
          operator: rule.operator,
          value: rule.value as Prisma.InputJsonValue,
          logicGroup: rule.logicGroup,
          sortOrder: index,
        })),
      },
    },
    include: { rules: true },
  });

  const estimate = await estimateSegment(input.clinicId, segment.id);
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "SEGMENT_CHANGE",
    entityType: "DynamicSegment",
    entityId: segment.id,
    afterData: { name: segment.name, estimatedCount: estimate.total },
  });
  return { segment, estimate };
}

export async function estimateSegment(clinicId: string, segmentId: string) {
  const segment = await prisma.dynamicSegment.findFirst({
    where: { id: segmentId, clinicId },
    include: { rules: { orderBy: { sortOrder: "asc" } } },
  });
  if (!segment) throw new Error("Segmento não encontrado");

  const rules = segment.rules.map((r) => ({
    field: r.field,
    operator: r.operator as Rule["operator"],
    value: r.value,
    logicGroup: r.logicGroup,
  }));

  const where = buildPatientWhere(clinicId, rules);
  const patients = await prisma.patient.findMany({
    where,
    select: {
      id: true,
      birthDate: true,
      marketingConsent: true,
      phone: true,
      email: true,
      status: true,
      wallets: {
        select: { availableBalance: true, pointsBalance: true },
      },
    },
  });

  let filtered = patients;

  const birthMonthRule = rules.find((r) => r.field === "birthMonth");
  if (birthMonthRule) {
    const month = Number(birthMonthRule.value);
    filtered = filtered.filter(
      (p) => p.birthDate && p.birthDate.getUTCMonth() + 1 === month,
    );
  }

  const ageMin = rules.find((r) => r.field === "ageMin");
  if (ageMin) {
    filtered = filtered.filter(
      (p) => p.birthDate && ageYears(p.birthDate) >= Number(ageMin.value),
    );
  }
  const ageMax = rules.find((r) => r.field === "ageMax");
  if (ageMax) {
    filtered = filtered.filter(
      (p) => p.birthDate && ageYears(p.birthDate) <= Number(ageMax.value),
    );
  }

  const withoutConsent = filtered.filter((p) => !p.marketingConsent).length;
  const invalidContact = filtered.filter(
    (p) => (!p.phone || p.phone.length < 10) && !p.email,
  ).length;
  const blocked = filtered.filter((p) => p.status === "BLOCKED").length;

  const estimatedBenefit = filtered.reduce((acc, p) => {
    const bal = Number(p.wallets[0]?.availableBalance ?? 0);
    return acc + bal;
  }, 0);
  const estimatedCommCost = filtered.length * 0.12;

  await prisma.dynamicSegment.update({
    where: { id: segmentId },
    data: {
      estimatedCount: filtered.length,
      lastCountedAt: new Date(),
    },
  });

  return {
    total: filtered.length,
    withoutConsent,
    invalidContact,
    blocked,
    eligible: Math.max(filtered.length - withoutConsent - blocked, 0),
    estimatedCommCost: money(estimatedCommCost).toFixed(2),
    estimatedBenefitsOffered: money(estimatedBenefit).toFixed(2),
    patientIds: filtered.map((p) => p.id),
  };
}

export async function listSegments(clinicId: string) {
  return prisma.dynamicSegment.findMany({
    where: { clinicId },
    include: { rules: true },
    orderBy: { updatedAt: "desc" },
  });
}
