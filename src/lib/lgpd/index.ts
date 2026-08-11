import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { cancelQueuedForPatient } from "@/lib/communications";

export async function exportPatientData(input: {
  clinicId: string;
  patientId: string;
  actorId?: string;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId: input.clinicId },
    include: {
      wallets: {
        include: {
          category: true,
          cards: true,
          ledgerEntries: { orderBy: { createdAt: "desc" }, take: 500 },
          creditLots: true,
        },
      },
      consents: true,
      consentRecords: true,
      communicationPreferences: true,
      appointments: { orderBy: { occurredAt: "desc" }, take: 200 },
      communications: { orderBy: { createdAt: "desc" }, take: 200 },
      surveyResponses: true,
      recoveryCases: true,
      referralsMade: true,
      referralsReceived: true,
      tagAssignments: { include: { tag: true } },
      rewardRedemptions: true,
      voucherRedemptions: true,
      giftCardsBought: true,
      giftCardsReceived: true,
      pushDevices: true,
      receiptSubmissions: true,
      raffleTickets: true,
      predictionScores: true,
    },
  });

  if (!patient) throw new Error("Paciente não encontrado");

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "OTHER",
    entityType: "Patient",
    entityId: patient.id,
    afterData: { lgpd: "export" },
  });

  return {
    exportedAt: new Date().toISOString(),
    purpose: "LGPD art. 18 — portabilidade/acesso",
    patient,
  };
}

function hashPii(value: string, salt: string) {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 16);
}

/**
 * Anonimiza o titular: remove PII identificável, bloqueia carteira/cartões,
 * cancela comunicações na fila e mantém lançamentos financeiros para auditoria
 * (saldos zerados / paciente marcado BLOCKED).
 */
export async function anonymizePatient(input: {
  clinicId: string;
  patientId: string;
  actorId?: string;
  reason?: string;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId: input.clinicId },
    include: { wallets: { include: { cards: true } } },
  });
  if (!patient) throw new Error("Paciente não encontrado");
  if (patient.status === "BLOCKED" && patient.fullName.startsWith("ANONIMIZADO")) {
    throw new Error("Paciente já anonimizado");
  }

  await cancelQueuedForPatient(input.clinicId, input.patientId).catch(() => undefined);

  const salt = patient.id;
  const anonCpf = hashPii(patient.cpf, salt).replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
  const anonPhone = `000${hashPii(patient.phone, salt).replace(/\D/g, "").slice(0, 8)}`;

  await prisma.$transaction(async (tx) => {
    await tx.patientOtp.deleteMany({
      where: { clinicId: input.clinicId, patientId: input.patientId },
    });
    await tx.pushDevice.deleteMany({
      where: { clinicId: input.clinicId, patientId: input.patientId },
    });
    await tx.communicationPreference.deleteMany({
      where: { clinicId: input.clinicId, patientId: input.patientId },
    });
    await tx.consentRecord.deleteMany({
      where: { clinicId: input.clinicId, patientId: input.patientId },
    });
    await tx.consent.deleteMany({
      where: { clinicId: input.clinicId, patientId: input.patientId },
    });

    for (const wallet of patient.wallets) {
      for (const card of wallet.cards) {
        await tx.card.update({
          where: { id: card.id },
          data: { status: "BLOCKED" },
        });
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          status: "CLOSED",
          availableBalance: 0,
          pendingBalance: 0,
          pointsBalance: 0,
        },
      });
    }

    await tx.patient.update({
      where: { id: patient.id },
      data: {
        fullName: `ANONIMIZADO ${hashPii(patient.fullName, salt).slice(0, 8).toUpperCase()}`,
        cpf: anonCpf,
        phone: anonPhone,
        email: null,
        gender: null,
        address: null,
        birthDate: null,
        commercialNotes: null,
        externalCode: null,
        marketingConsent: false,
        regulationConsent: false,
        status: "BLOCKED",
      },
    });
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "OTHER",
    entityType: "Patient",
    entityId: patient.id,
    afterData: {
      lgpd: "anonymize",
      reason: input.reason ?? "solicitacao_titular",
    },
  });

  return { ok: true as const, patientId: patient.id };
}
