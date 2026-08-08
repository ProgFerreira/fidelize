"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createPatient, updatePatient, patientSchema } from "@/lib/patients";
import { onlyDigits } from "@/lib/patients/cpf";
import { linkCard, blockCard, createCardStock } from "@/lib/cards";
import { confirmAppointment } from "@/lib/reception";
import { simulateBenefit } from "@/lib/cashback";
import { prisma } from "@/lib/db";
import { saveBenefitSettings, type BenefitSettings } from "@/lib/cashback";
import { reverseLedgerEntry } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { toPlain } from "@/lib/serialize";

export async function createPatientAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_WRITE);
  const raw = Object.fromEntries(formData.entries());
  const data = patientSchema.parse({
    ...raw,
    regulationConsent: formData.get("regulationConsent") === "on",
    marketingConsent: formData.get("marketingConsent") === "on",
  });

  const patient = await createPatient({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data,
  });

  revalidatePath("/pacientes");
  return { ok: true as const, patientId: patient.id };
}

export async function updatePatientAction(patientId: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_WRITE);
  const raw = Object.fromEntries(formData.entries());
  const data = patientSchema.partial().parse({
    ...raw,
    regulationConsent: formData.has("regulationConsent")
      ? formData.get("regulationConsent") === "on"
      : undefined,
    marketingConsent: formData.has("marketingConsent")
      ? formData.get("marketingConsent") === "on"
      : undefined,
  });

  await updatePatient({
    clinicId: session.user.clinicId,
    patientId,
    actorId: session.user.id,
    data,
  });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/pacientes");
}

export async function createCardStockAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const quantity = Number(formData.get("quantity") || 0);
  const unitId = String(formData.get("unitId") || "") || null;
  const count = await createCardStock({
    clinicId: session.user.clinicId,
    unitId,
    quantity,
  });
  revalidatePath("/cartoes");
}

export async function linkCardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const publicToken = String(formData.get("publicToken") || "");
  const walletId = String(formData.get("walletId") || "");
  await linkCard({
    clinicId: session.user.clinicId,
    publicToken,
    walletId,
    actorId: session.user.id,
  });
  revalidatePath("/cartoes");
  revalidatePath("/recepcao");
}

export async function blockCardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  await blockCard({
    clinicId: session.user.clinicId,
    cardId: String(formData.get("cardId") || ""),
    actorId: session.user.id,
    reason: String(formData.get("reason") || "Bloqueio administrativo"),
  });
  revalidatePath("/cartoes");
}

export async function simulateReceptionAction(input: {
  walletId: string;
  procedureId?: string;
  campaignId?: string;
  grossAmount: number;
  discountAmount?: number;
  benefitToUse?: number;
}) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const wallet = await prisma.wallet.findFirst({
    where: { id: input.walletId, clinicId: session.user.clinicId },
    include: { category: true },
  });
  if (!wallet) throw new Error("Carteira não encontrada");

  const procedure = input.procedureId
    ? await prisma.procedure.findFirst({
        where: { id: input.procedureId, clinicId: session.user.clinicId },
      })
    : null;
  const campaign = input.campaignId
    ? await prisma.campaign.findFirst({
        where: { id: input.campaignId, clinicId: session.user.clinicId },
      })
    : null;

  return simulateBenefit({
    clinicId: session.user.clinicId,
    categoryCashbackPercent: wallet.category
      ? Number(wallet.category.cashbackPercent)
      : null,
    procedureCashbackPercent: procedure?.cashbackPercent
      ? Number(procedure.cashbackPercent)
      : null,
    campaignExtraPercent: campaign ? Number(campaign.extraCashbackPct) : null,
    grossAmount: input.grossAmount,
    discountAmount: input.discountAmount,
    benefitToUse: input.benefitToUse,
    availableBalance: Number(wallet.availableBalance),
  });
}

export async function confirmReceptionAction(input: {
  patientId: string;
  walletId: string;
  procedureId?: string;
  campaignId?: string;
  grossAmount: number;
  discountAmount?: number;
  benefitToUse?: number;
  professionalName?: string;
  idempotencyKey: string;
  unitId?: string;
}) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const result = await confirmAppointment({
    clinicId: session.user.clinicId,
    unitId: input.unitId ?? session.user.unitId,
    patientId: input.patientId,
    walletId: input.walletId,
    procedureId: input.procedureId,
    campaignId: input.campaignId,
    operatorId: session.user.id,
    professionalName: input.professionalName,
    grossAmount: input.grossAmount,
    discountAmount: input.discountAmount,
    benefitToUse: input.benefitToUse,
    idempotencyKey: input.idempotencyKey,
  });
  revalidatePath("/recepcao");
  revalidatePath("/dashboard");
  return toPlain(result);
}

export async function saveSettingsAction(settings: BenefitSettings) {
  const session = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  await saveBenefitSettings(session.user.clinicId, settings);
  await writeAuditLog({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "SETTINGS_CHANGE",
    entityType: "Setting",
    afterData: JSON.parse(JSON.stringify(settings)),
  });
  revalidatePath("/configuracoes");
}

export async function saveCategoryAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const id = String(formData.get("id") || "");
  const payload = {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    color: String(formData.get("color") || "#C2A46B"),
    icon: String(formData.get("icon") || "sparkles"),
    minAnnualSpend: String(formData.get("minAnnualSpend") || "0"),
    minPoints: Number(formData.get("minPoints") || 0),
    minAppointments: Number(formData.get("minAppointments") || 0),
    cashbackPercent: String(formData.get("cashbackPercent") || "0"),
    discountPercent: String(formData.get("discountPercent") || "0"),
    benefits: String(formData.get("benefits") || ""),
    sortOrder: Number(formData.get("sortOrder") || 0),
    progressionMode: String(formData.get("progressionMode") || "SPEND") as
      | "SPEND"
      | "POINTS"
      | "APPOINTMENTS"
      | "COMBINED",
    active: formData.get("active") === "on",
  };

  if (id) {
    await prisma.category.update({
      where: { id },
      data: payload,
    });
  } else {
    await prisma.category.create({
      data: { clinicId: session.user.clinicId, ...payload },
    });
  }

  await writeAuditLog({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "CATEGORY_CHANGE",
    entityType: "Category",
    afterData: payload,
  });

  revalidatePath("/configuracoes");
}

export async function saveCampaignAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE);
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || ""),
    status: String(formData.get("status") || "DRAFT") as
      | "DRAFT"
      | "SCHEDULED"
      | "ACTIVE"
      | "ENDED"
      | "CANCELLED",
    extraCashbackPct: String(formData.get("extraCashbackPct") || "0"),
    extraPoints: Number(formData.get("extraPoints") || 0),
    benefitDescription: String(formData.get("benefitDescription") || ""),
    couponCode: String(formData.get("couponCode") || "") || null,
    startsAt: formData.get("startsAt")
      ? new Date(String(formData.get("startsAt")))
      : null,
    endsAt: formData.get("endsAt")
      ? new Date(String(formData.get("endsAt")))
      : null,
  };

  if (id) {
    await prisma.campaign.update({ where: { id }, data });
  } else {
    await prisma.campaign.create({
      data: { clinicId: session.user.clinicId, ...data },
    });
  }

  revalidatePath("/campanhas");
}

export async function reverseEntryAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.FINANCE_REVERSAL);
  const entryId = String(formData.get("entryId") || "");
  const reason = String(formData.get("reason") || "Estorno autorizado");
  await reverseLedgerEntry({
    clinicId: session.user.clinicId,
    entryId,
    operatorId: session.user.id,
    reason,
  });
  await writeAuditLog({
    clinicId: session.user.clinicId,
    userId: session.user.id,
    action: "REVERSAL",
    entityType: "LedgerEntry",
    entityId: entryId,
    afterData: { reason },
  });
  revalidatePath("/relatorios");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase();
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) return;

  const token = crypto.randomUUID();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: token,
      resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

export async function searchPatientsAction(query: string) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const q = query.trim();
  if (!q) return [];

  const digits = onlyDigits(q);

  return toPlain(
    await prisma.patient.findMany({
      where: {
        clinicId: session.user.clinicId,
        OR: [
          { fullName: { contains: q } },
          { externalCode: { contains: q } },
          {
            wallets: {
              some: {
                cards: {
                  some: {
                    OR: [
                      { publicToken: { contains: q } },
                      { cardNumber: { contains: q } },
                    ],
                  },
                },
              },
            },
          },
          ...(digits
            ? [
                { cpf: { contains: digits } },
                { phone: { contains: digits } },
              ]
            : []),
        ],
      },
      include: {
        wallets: {
          where: { status: "ACTIVE" },
          include: { category: true, cards: { where: { status: "ACTIVE" } } },
        },
        unit: true,
      },
      take: 20,
    }),
  );
}

export async function getPatientAppointmentHistoryAction(patientId: string) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  if (!patientId) return [];

  return toPlain(
    await prisma.appointment.findMany({
      where: {
        clinicId: session.user.clinicId,
        patientId,
        status: { in: ["CONFIRMED", "CANCELLED", "REVERSED"] },
      },
      include: {
        procedure: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
  );
}
