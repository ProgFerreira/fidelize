import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { organizacaoAtual } from "@/lib/tenant";
import { moneyToString } from "@/lib/money";

const optionalPrice = z.preprocess((v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? v : n;
}, z.number().min(0, "Valor inválido").nullable());

export const professionalSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  specialty: z
    .string()
    .trim()
    .min(2, "Informe o que o profissional faz")
    .max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
  active: z.coerce.boolean().default(true),
  color: z.string().trim().max(32).optional().nullable(),
  procedureIds: z.array(z.string().min(1)).default([]),
  procedurePrices: z.record(z.string(), optionalPrice).default({}),
});

export type ProfessionalInput = z.infer<typeof professionalSchema>;

export type ProfessionalDTO = {
  id: string;
  name: string;
  specialty: string;
  notes: string | null;
  active: boolean;
  color: string | null;
  procedureIds: string[];
  procedureNames: string[];
  /** Preço próprio por serviço; null = usa o preço do catálogo. */
  procedurePrices: Record<string, number | null>;
};

const include = {
  procedures: {
    include: { procedure: { select: { id: true, name: true } } },
  },
} as const;

function toDTO(row: {
  id: string;
  name: string;
  specialty: string;
  notes: string | null;
  active: boolean;
  color: string | null;
  procedures: {
    price: unknown;
    procedure: { id: string; name: string };
  }[];
}): ProfessionalDTO {
  const procedurePrices: Record<string, number | null> = {};
  for (const link of row.procedures) {
    procedurePrices[link.procedure.id] =
      link.price == null ? null : Number(link.price);
  }
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    notes: row.notes,
    active: row.active,
    color: row.color,
    procedureIds: row.procedures.map((p) => p.procedure.id),
    procedureNames: row.procedures.map((p) => p.procedure.name),
    procedurePrices,
  };
}

function linksToCreate(
  procedureIds: string[],
  procedurePrices: Record<string, number | null | undefined>,
) {
  return procedureIds.map((procedureId) => {
    const override = procedurePrices[procedureId];
    return {
      procedureId,
      price:
        override == null || Number.isNaN(Number(override))
          ? null
          : moneyToString(override),
    };
  });
}

async function assertProcedures(clinicId: string, procedureIds: string[]) {
  if (!procedureIds.length) return;
  const count = await prisma.procedure.count({
    where: { clinicId, id: { in: procedureIds }, active: true },
  });
  if (count !== procedureIds.length) {
    throw new Error("Um ou mais tipos de atendimento são inválidos");
  }
}

export async function listProfessionals(params: {
  clinicId: string;
  activeOnly?: boolean;
}) {
  const rows = await prisma.professional.findMany({
    where: {
      clinicId: params.clinicId,
      ...(params.activeOnly ? { active: true } : {}),
    },
    include,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map(toDTO);
}

export async function getProfessional(clinicId: string, id: string) {
  const row = await prisma.professional.findFirst({
    where: { id, clinicId },
    include,
  });
  return row ? toDTO(row) : null;
}

export async function createProfessional(params: {
  clinicId: string;
  actorId: string;
  unitId?: string | null;
  data: ProfessionalInput;
}) {
  const data = professionalSchema.parse(params.data);
  await assertProcedures(params.clinicId, data.procedureIds);

  const row = await prisma.professional.create({
    data: {
      organizationId: organizacaoAtual(),
      clinicId: params.clinicId,
      unitId: params.unitId ?? null,
      name: data.name,
      specialty: data.specialty,
      notes: data.notes || null,
      active: data.active,
      color: data.color || null,
      procedures: {
        create: linksToCreate(data.procedureIds, data.procedurePrices),
      },
    },
    include,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTHER",
    entityType: "Professional",
    entityId: row.id,
    afterData: { name: row.name, specialty: row.specialty, active: row.active },
    metadata: { kind: "professional.create" },
  });

  return toDTO(row);
}

export async function updateProfessional(params: {
  clinicId: string;
  actorId: string;
  id: string;
  data: ProfessionalInput;
}) {
  const existing = await prisma.professional.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
    select: { id: true, name: true, specialty: true, active: true },
  });
  if (!existing) throw new Error("Profissional não encontrado");

  const data = professionalSchema.parse(params.data);
  await assertProcedures(params.clinicId, data.procedureIds);

  await prisma.professionalProcedure.deleteMany({
    where: { professionalId: existing.id },
  });

  const row = await prisma.professional.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      specialty: data.specialty,
      notes: data.notes || null,
      active: data.active,
      color: data.color || null,
      procedures: {
        create: linksToCreate(data.procedureIds, data.procedurePrices),
      },
    },
    include,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTHER",
    entityType: "Professional",
    entityId: row.id,
    beforeData: {
      name: existing.name,
      specialty: existing.specialty,
      active: existing.active,
    },
    afterData: { name: row.name, specialty: row.specialty, active: row.active },
    metadata: { kind: "professional.update" },
  });

  return toDTO(row);
}

export async function setProfessionalActive(params: {
  clinicId: string;
  actorId: string;
  id: string;
  active: boolean;
}) {
  const existing = await prisma.professional.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
  });
  if (!existing) throw new Error("Profissional não encontrado");

  const row = await prisma.professional.update({
    where: { id: existing.id },
    data: { active: params.active },
    include,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTHER",
    entityType: "Professional",
    entityId: row.id,
    afterData: { active: row.active },
    metadata: { kind: "professional.active" },
  });

  return toDTO(row);
}
