import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { organizacaoAtual } from "@/lib/tenant";
import { moneyToString } from "@/lib/money";
import {
  deleteManagedServiceImage,
  isManagedServiceImage,
} from "@/lib/uploads/service-image";

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  description: z.string().trim().max(4000).optional().nullable(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  basePrice: z.coerce.number().min(0, "Valor inválido"),
  compareAtPrice: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0, "Valor de tabela inválido").nullable().optional(),
  ),
  validityDays: z.coerce.number().int().min(0).optional().nullable(),
  intervaloRetornoDias: z.coerce.number().int().min(0).max(730).optional().nullable(),
  packageSessions: z.coerce.number().int().min(0).max(99).optional().nullable(),
  stockQty: z.coerce.number().int().min(0).optional().nullable(),
  stockAlertAt: z.coerce.number().int().min(0).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(24 * 60).optional().nullable(),
  cashbackPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  pointsPerReal: z.coerce.number().min(0).optional().nullable(),
  eligible: z.coerce.boolean().default(true),
  active: z.coerce.boolean().default(true),
}).superRefine((data, ctx) => {
  if (
    data.compareAtPrice != null &&
    !Number.isNaN(data.compareAtPrice) &&
    data.compareAtPrice > 0 &&
    data.compareAtPrice <= data.basePrice
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["compareAtPrice"],
      message: "O preço “De” deve ser maior que o preço “Por”",
    });
  }
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export type ServiceDTO = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  validityDays: number | null;
  intervaloRetornoDias: number | null;
  packageSessions: number | null;
  stockQty: number | null;
  stockAlertAt: number | null;
  durationMinutes: number | null;
  cashbackPercent: number | null;
  pointsPerReal: number | null;
  eligible: boolean;
  active: boolean;
  professionalCount: number;
  professionalNames: string[];
  professionals: Array<{
    id: string;
    name: string;
    price: number | null;
  }>;
};

function slugCode(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return base || "SERVICO";
}

async function uniqueCode(clinicId: string, preferred: string | null, name: string) {
  const root = (preferred || slugCode(name)).slice(0, 32);
  let candidate = root;
  let i = 1;
  while (
    await prisma.procedure.findFirst({
      where: { clinicId, code: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${root.slice(0, 28)}-${i}`;
    i += 1;
    if (i > 50) throw new Error("Não foi possível gerar código único");
  }
  return candidate;
}

function toDTO(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: unknown;
  compareAtPrice: unknown;
  validityDays: number | null;
  intervaloRetornoDias: number | null;
  packageSessions: number | null;
  stockQty: number | null;
  stockAlertAt: number | null;
  durationMinutes: number | null;
  cashbackPercent: unknown;
  pointsPerReal: unknown;
  eligible: boolean;
  active: boolean;
  professionalLinks: {
    price: unknown;
    professional: { id: string; name: string };
  }[];
}): ServiceDTO {
  const professionals = row.professionalLinks.map((l) => ({
    id: l.professional.id,
    name: l.professional.name,
    price: l.price == null ? null : Number(l.price),
  }));
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    basePrice: Number(row.basePrice),
    compareAtPrice:
      row.compareAtPrice == null ? null : Number(row.compareAtPrice),
    validityDays: row.validityDays,
    intervaloRetornoDias: row.intervaloRetornoDias,
    packageSessions: row.packageSessions,
    stockQty: row.stockQty,
    stockAlertAt: row.stockAlertAt,
    durationMinutes: row.durationMinutes,
    cashbackPercent:
      row.cashbackPercent == null ? null : Number(row.cashbackPercent),
    pointsPerReal: row.pointsPerReal == null ? null : Number(row.pointsPerReal),
    eligible: row.eligible,
    active: row.active,
    professionalCount: professionals.length,
    professionalNames: professionals.map((p) => p.name),
    professionals,
  };
}

const include = {
  professionalLinks: {
    include: { professional: { select: { id: true, name: true } } },
  },
} as const;

export async function listServices(params: {
  clinicId: string;
  activeOnly?: boolean;
  query?: string;
}) {
  const q = params.query?.trim();
  const rows = await prisma.procedure.findMany({
    where: {
      clinicId: params.clinicId,
      ...(params.activeOnly ? { active: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { code: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    include,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map(toDTO);
}

export async function createService(params: {
  clinicId: string;
  actorId: string;
  data: ServiceInput;
}) {
  const data = serviceSchema.parse(params.data);
  const code = await uniqueCode(params.clinicId, data.code, data.name);

  const row = await prisma.procedure.create({
    data: {
      organizationId: organizacaoAtual(),
      clinicId: params.clinicId,
      code,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      basePrice: moneyToString(data.basePrice),
      compareAtPrice:
        data.compareAtPrice == null || Number.isNaN(data.compareAtPrice)
          ? null
          : moneyToString(data.compareAtPrice),
      validityDays: data.validityDays || null,
      intervaloRetornoDias: data.intervaloRetornoDias || null,
      packageSessions: data.packageSessions || null,
      stockQty: data.stockQty ?? null,
      stockAlertAt: data.stockAlertAt ?? null,
      durationMinutes: data.durationMinutes ?? 60,
      cashbackPercent:
        data.cashbackPercent == null || Number.isNaN(data.cashbackPercent)
          ? null
          : moneyToString(data.cashbackPercent),
      pointsPerReal:
        data.pointsPerReal == null || Number.isNaN(data.pointsPerReal)
          ? null
          : moneyToString(data.pointsPerReal),
      eligible: data.eligible,
      active: data.active,
    },
    include,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTHER",
    entityType: "Procedure",
    entityId: row.id,
    afterData: {
      name: row.name,
      code: row.code,
      basePrice: Number(row.basePrice),
      compareAtPrice:
        row.compareAtPrice == null ? null : Number(row.compareAtPrice),
    },
    metadata: { kind: "service.create" },
  });

  return toDTO(row);
}

export async function updateService(params: {
  clinicId: string;
  actorId: string;
  id: string;
  data: ServiceInput;
}) {
  const existing = await prisma.procedure.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
  });
  if (!existing) throw new Error("Serviço não encontrado");

  const data = serviceSchema.parse(params.data);
  let code = existing.code;
  if (data.code && data.code !== existing.code) {
    const clash = await prisma.procedure.findFirst({
      where: {
        clinicId: params.clinicId,
        code: data.code,
        NOT: { id: existing.id },
      },
      select: { id: true },
    });
    if (clash) throw new Error("Já existe um serviço com este código");
    code = data.code;
  }

  const nextImage = data.imageUrl || null;
  if (
    existing.imageUrl &&
    existing.imageUrl !== nextImage &&
    isManagedServiceImage(existing.imageUrl)
  ) {
    await deleteManagedServiceImage(existing.imageUrl);
  }

  const row = await prisma.procedure.update({
    where: { id: existing.id },
    data: {
      code,
      name: data.name,
      description: data.description || null,
      imageUrl: nextImage,
      basePrice: moneyToString(data.basePrice),
      compareAtPrice:
        data.compareAtPrice == null || Number.isNaN(data.compareAtPrice)
          ? null
          : moneyToString(data.compareAtPrice),
      validityDays: data.validityDays || null,
      intervaloRetornoDias: data.intervaloRetornoDias || null,
      packageSessions: data.packageSessions || null,
      stockQty: data.stockQty ?? null,
      stockAlertAt: data.stockAlertAt ?? null,
      durationMinutes: data.durationMinutes ?? 60,
      cashbackPercent:
        data.cashbackPercent == null || Number.isNaN(data.cashbackPercent)
          ? null
          : moneyToString(data.cashbackPercent),
      pointsPerReal:
        data.pointsPerReal == null || Number.isNaN(data.pointsPerReal)
          ? null
          : moneyToString(data.pointsPerReal),
      eligible: data.eligible,
      active: data.active,
    },
    include,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTHER",
    entityType: "Procedure",
    entityId: row.id,
    beforeData: {
      name: existing.name,
      basePrice: Number(existing.basePrice),
      compareAtPrice:
        existing.compareAtPrice == null
          ? null
          : Number(existing.compareAtPrice),
      active: existing.active,
      imageUrl: existing.imageUrl,
    },
    afterData: {
      name: row.name,
      basePrice: Number(row.basePrice),
      compareAtPrice:
        row.compareAtPrice == null ? null : Number(row.compareAtPrice),
      active: row.active,
      imageUrl: row.imageUrl,
    },
    metadata: { kind: "service.update" },
  });

  return toDTO(row);
}

export async function setServiceActive(params: {
  clinicId: string;
  actorId: string;
  id: string;
  active: boolean;
}) {
  const existing = await prisma.procedure.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
  });
  if (!existing) throw new Error("Serviço não encontrado");

  const row = await prisma.procedure.update({
    where: { id: existing.id },
    data: { active: params.active },
    include,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTHER",
    entityType: "Procedure",
    entityId: row.id,
    afterData: { active: row.active },
    metadata: { kind: "service.active" },
  });

  return toDTO(row);
}
