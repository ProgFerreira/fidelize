import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import type { CommunicationChannel, ConsentPurpose } from "@/generated/prisma/client";

export const consentSchema = z.object({
  patientId: z.string().min(1),
  purpose: z.enum(["TRANSACTIONAL", "SERVICE", "MARKETING", "SURVEY", "REFERRAL"]),
  channel: z
    .enum(["WHATSAPP", "EMAIL", "SMS", "PUSH", "INTERNAL"])
    .optional()
    .nullable(),
  accepted: z.boolean(),
  textAccepted: z.string().max(5000).optional().nullable(),
  version: z.string().max(40).optional().nullable(),
  origin: z.string().max(120).optional().nullable(),
  ipAddress: z.string().max(64).optional().nullable(),
});

export async function recordConsent(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof consentSchema>;
}) {
  await requireModule(input.clinicId, "CONSENT");
  const data = consentSchema.parse(input.data);

  const record = await prisma.consentRecord.create({
    data: {
      clinicId: input.clinicId,
      patientId: data.patientId,
      purpose: data.purpose as ConsentPurpose,
      channel: (data.channel as CommunicationChannel | null) ?? null,
      accepted: data.accepted,
      textAccepted: data.textAccepted ?? null,
      version: data.version ?? "1",
      origin: data.origin ?? "admin",
      ipAddress: data.ipAddress ?? null,
      revokedAt: data.accepted ? null : new Date(),
    },
  });

  if (data.purpose === "MARKETING") {
    await prisma.patient.update({
      where: { id: data.patientId },
      data: { marketingConsent: data.accepted },
    });
  }

  if (data.channel) {
    await prisma.communicationPreference.upsert({
      where: {
        patientId_channel_purpose: {
          patientId: data.patientId,
          channel: data.channel as CommunicationChannel,
          purpose: data.purpose as ConsentPurpose,
        },
      },
      create: {
        clinicId: input.clinicId,
        patientId: data.patientId,
        channel: data.channel as CommunicationChannel,
        purpose: data.purpose as ConsentPurpose,
        allowed: data.accepted,
      },
      update: { allowed: data.accepted },
    });
  }

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "CONSENT_CHANGE",
    entityType: "ConsentRecord",
    entityId: record.id,
    afterData: {
      patientId: data.patientId,
      purpose: data.purpose,
      accepted: data.accepted,
    },
  });

  return record;
}

export async function hasMarketingConsent(
  clinicId: string,
  patientId: string,
  channel?: CommunicationChannel,
) {
  if (channel) {
    const pref = await prisma.communicationPreference.findUnique({
      where: {
        patientId_channel_purpose: {
          patientId,
          channel,
          purpose: "MARKETING",
        },
      },
    });
    if (pref) return pref.allowed;
  }

  const latest = await prisma.consentRecord.findFirst({
    where: {
      clinicId,
      patientId,
      purpose: "MARKETING",
    },
    orderBy: { createdAt: "desc" },
  });
  if (latest) return latest.accepted && !latest.revokedAt;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    select: { marketingConsent: true },
  });
  return Boolean(patient?.marketingConsent);
}

export async function backfillConsentsFromPatients(clinicId: string) {
  const patients = await prisma.patient.findMany({
    where: { clinicId },
    select: {
      id: true,
      marketingConsent: true,
      regulationConsent: true,
    },
  });

  for (const patient of patients) {
    if (patient.regulationConsent) {
      await prisma.consentRecord.create({
        data: {
          clinicId,
          patientId: patient.id,
          purpose: "SERVICE",
          accepted: true,
          version: "legacy",
          origin: "backfill",
          textAccepted: "Consentimento de regulamento migrado",
        },
      });
    }
    await prisma.consentRecord.create({
      data: {
        clinicId,
        patientId: patient.id,
        purpose: "MARKETING",
        accepted: patient.marketingConsent,
        version: "legacy",
        origin: "backfill",
        textAccepted: "Preferência de marketing migrada",
        revokedAt: patient.marketingConsent ? null : new Date(),
      },
    });
  }
}

export async function listConsentRecords(clinicId: string, patientId?: string) {
  return prisma.consentRecord.findMany({
    where: {
      clinicId,
      ...(patientId ? { patientId } : {}),
    },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
