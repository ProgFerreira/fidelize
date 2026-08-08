import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { onlyDigits, isValidCpf } from "@/lib/patients/cpf";

export { onlyDigits, isValidCpf } from "@/lib/patients/cpf";

export const patientSchema = z.object({
  fullName: z.string().min(3, "Nome obrigatório"),
  cpf: z
    .string()
    .refine((v) => isValidCpf(v), "CPF inválido"),
  birthDate: z.string().optional().nullable(),
  phone: z.string().min(10, "Telefone obrigatório"),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  externalCode: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  commercialNotes: z.string().optional().nullable(),
  regulationConsent: z.boolean(),
  marketingConsent: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).default("ACTIVE"),
});

export type PatientInput = z.infer<typeof patientSchema>;

export async function findPatientDuplicates(params: {
  clinicId: string;
  cpf: string;
  phone?: string;
  externalCode?: string | null;
  excludeId?: string;
}) {
  const cpf = onlyDigits(params.cpf);
  const phone = params.phone ? onlyDigits(params.phone) : undefined;

  const cpfMatch = await prisma.patient.findFirst({
    where: {
      clinicId: params.clinicId,
      cpf,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
  });

  const phoneMatches = phone
    ? await prisma.patient.findMany({
        where: {
          clinicId: params.clinicId,
          phone: { contains: phone.slice(-8) },
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        },
        take: 5,
      })
    : [];

  const externalMatches = params.externalCode
    ? await prisma.patient.findMany({
        where: {
          clinicId: params.clinicId,
          externalCode: params.externalCode,
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        },
        take: 5,
      })
    : [];

  return { cpfMatch, phoneMatches, externalMatches };
}

export async function createPatient(params: {
  clinicId: string;
  actorId: string;
  data: PatientInput;
}) {
  const data = patientSchema.parse(params.data);
  const cpf = onlyDigits(data.cpf);
  const phone = onlyDigits(data.phone);

  const dup = await findPatientDuplicates({
    clinicId: params.clinicId,
    cpf,
    phone,
    externalCode: data.externalCode,
  });
  if (dup.cpfMatch) {
    throw new Error("Já existe paciente com este CPF nesta clínica");
  }

  const bronze = await prisma.category.findFirst({
    where: { clinicId: params.clinicId, slug: "bronze", active: true },
  });

  const patient = await prisma.$transaction(async (tx) => {
    const created = await tx.patient.create({
      data: {
        clinicId: params.clinicId,
        unitId: data.unitId || null,
        fullName: data.fullName.trim(),
        cpf,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        phone,
        email: data.email || null,
        gender: data.gender || null,
        address: data.address || null,
        externalCode: data.externalCode || null,
        commercialNotes: data.commercialNotes || null,
        regulationConsent: data.regulationConsent,
        marketingConsent: data.marketingConsent,
        status: data.status,
        consents: {
          create: [
            {
              clinicId: params.clinicId,
              type: "regulation",
              accepted: data.regulationConsent,
              version: "1.0",
            },
            {
              clinicId: params.clinicId,
              type: "marketing",
              accepted: data.marketingConsent,
              version: "1.0",
            },
          ],
        },
      },
    });

    await tx.wallet.create({
      data: {
        clinicId: params.clinicId,
        patientId: created.id,
        categoryId: bronze?.id,
        status: "ACTIVE",
      },
    });

    return created;
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "PATIENT_CREATE",
    entityType: "Patient",
    entityId: patient.id,
    afterData: { fullName: patient.fullName, cpf: patient.cpf },
  });

  try {
    const { runAutomationsForTrigger } = await import("@/lib/automations");
    const { recordConsent } = await import("@/lib/consent");
    const wallet = await prisma.wallet.findFirst({
      where: { clinicId: params.clinicId, patientId: patient.id },
    });
    await recordConsent({
      clinicId: params.clinicId,
      actorId: params.actorId,
      data: {
        patientId: patient.id,
        purpose: "MARKETING",
        accepted: data.marketingConsent,
        version: "1.0",
        origin: "patient_create",
        textAccepted: "Preferência registrada no cadastro",
      },
    }).catch(() => undefined);
    await runAutomationsForTrigger({
      clinicId: params.clinicId,
      trigger: "PATIENT_REGISTERED",
      patientId: patient.id,
      triggerRef: patient.id,
      context: { walletId: wallet?.id, unitId: patient.unitId },
    });
    const { linkReferralLeadToPatient } = await import("@/lib/referrals");
    await linkReferralLeadToPatient({
      clinicId: params.clinicId,
      patientId: patient.id,
      phone,
    });
  } catch {
    // best-effort
  }

  return patient;
}

export async function updatePatient(params: {
  clinicId: string;
  patientId: string;
  actorId: string;
  data: Partial<PatientInput>;
}) {
  const existing = await prisma.patient.findFirst({
    where: { id: params.patientId, clinicId: params.clinicId },
  });
  if (!existing) throw new Error("Paciente não encontrado");

  const merged = {
    fullName: params.data.fullName ?? existing.fullName,
    cpf: params.data.cpf ?? existing.cpf,
    birthDate: params.data.birthDate ?? existing.birthDate?.toISOString().slice(0, 10),
    phone: params.data.phone ?? existing.phone,
    email: params.data.email ?? existing.email,
    gender: params.data.gender ?? existing.gender,
    address: params.data.address ?? existing.address,
    externalCode: params.data.externalCode ?? existing.externalCode,
    unitId: params.data.unitId ?? existing.unitId,
    commercialNotes: params.data.commercialNotes ?? existing.commercialNotes,
    regulationConsent:
      params.data.regulationConsent ?? existing.regulationConsent,
    marketingConsent: params.data.marketingConsent ?? existing.marketingConsent,
    status: params.data.status ?? existing.status,
  };

  const data = patientSchema.parse(merged);
  const cpf = onlyDigits(data.cpf);

  const dup = await findPatientDuplicates({
    clinicId: params.clinicId,
    cpf,
    phone: data.phone,
    externalCode: data.externalCode,
    excludeId: params.patientId,
  });
  if (dup.cpfMatch) {
    throw new Error("Já existe paciente com este CPF nesta clínica");
  }

  const updated = await prisma.patient.update({
    where: { id: params.patientId },
    data: {
      fullName: data.fullName.trim(),
      cpf,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      phone: onlyDigits(data.phone),
      email: data.email || null,
      gender: data.gender || null,
      address: data.address || null,
      externalCode: data.externalCode || null,
      unitId: data.unitId || null,
      commercialNotes: data.commercialNotes || null,
      regulationConsent: data.regulationConsent,
      marketingConsent: data.marketingConsent,
      status: data.status,
    },
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "PATIENT_UPDATE",
    entityType: "Patient",
    entityId: updated.id,
    beforeData: { fullName: existing.fullName, status: existing.status },
    afterData: { fullName: updated.fullName, status: updated.status },
  });

  return { patient: updated, warnings: { phoneMatches: dup.phoneMatches, externalMatches: dup.externalMatches } };
}
