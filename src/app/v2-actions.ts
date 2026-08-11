"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { setModuleEnabled } from "@/lib/modules";
import { createTag, assignTag, removeTag, bulkAssignTag } from "@/lib/tags";
import { createSegment, estimateSegment } from "@/lib/segments";
import { recordConsent } from "@/lib/consent";
import { createTemplate, approveTemplate } from "@/lib/templates";
import {
  enqueueCommunication,
  processCommunicationQueue,
} from "@/lib/communications";
import {
  createAutomation,
  setAutomationStatus,
  seedPresetAutomations,
  duplicateAutomation,
} from "@/lib/automations";
import { upsertReferralProgram } from "@/lib/referrals";
import { createReward, redeemReward, fulfillReward } from "@/lib/rewards";
import { createVoucher, redeemVoucher } from "@/lib/vouchers";
import { issueGiftCard, activateGiftCard, redeemGiftCard } from "@/lib/giftcards";
import { createAccelerator } from "@/lib/accelerators";
import { classifyInactivePatients } from "@/lib/recovery";
import {
  createApiCredential,
  revokeApiCredential,
  createWebhookEndpoint,
} from "@/lib/integrations";
import { setOnboardingStep } from "@/lib/onboarding";
import { createRaffle, setRaffleStatus, drawRaffle } from "@/lib/raffles";
import { submitReceipt, reviewReceipt } from "@/lib/receipts";
import {
  computePatientPredictions,
  forecastRevenue,
} from "@/lib/predictive";
import { addWidgetOrigin } from "@/lib/widget";
import { prisma } from "@/lib/db";
import { toPlain } from "@/lib/serialize";
import type { ModuleCode, OnboardingStepCode, RaffleStatus } from "@/generated/prisma/client";

export async function toggleModuleAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MODULES_MANAGE);
  const code = String(formData.get("code")) as ModuleCode;
  const enabled = formData.get("enabled") === "true";
  await setModuleEnabled({
    clinicId: session.user.clinicId,
    code,
    enabled,
    actorId: session.user.id,
  });
  revalidatePath("/modulos");
}

export async function createTagAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.TAGS_MANAGE);
  await createTag({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || ""),
      color: String(formData.get("color") || "#64748b"),
      description: String(formData.get("description") || "") || null,
    },
  });
  revalidatePath("/pacientes");
  revalidatePath("/modulos");
}

export async function assignTagAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.TAGS_MANAGE);
  await assignTag({
    clinicId: session.user.clinicId,
    patientId: String(formData.get("patientId")),
    tagId: String(formData.get("tagId")),
    actorId: session.user.id,
  });
  revalidatePath(`/pacientes/${formData.get("patientId")}`);
}

export async function removeTagAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.TAGS_MANAGE);
  await removeTag({
    clinicId: session.user.clinicId,
    patientId: String(formData.get("patientId")),
    tagId: String(formData.get("tagId")),
    actorId: session.user.id,
  });
  revalidatePath(`/pacientes/${formData.get("patientId")}`);
}

export async function bulkAssignTagAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.TAGS_MANAGE);
  const patientIds = String(formData.get("patientIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await bulkAssignTag({
    clinicId: session.user.clinicId,
    tagId: String(formData.get("tagId")),
    patientIds,
    actorId: session.user.id,
  });
  revalidatePath("/pacientes");
}

export async function createSegmentAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SEGMENTS_MANAGE);
  const field = String(formData.get("field") || "marketingConsent");
  const operator = String(formData.get("operator") || "eq") as
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "contains"
    | "between";
  let value: unknown = formData.get("value");
  if (field === "marketingConsent") value = value === "true" || value === "on";
  if (["minSpend", "minPoints", "minBalance", "minAppointments", "birthMonth"].includes(field)) {
    value = Number(value);
  }
  await createSegment({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      rules: [{ field, operator, value, logicGroup: "AND" }],
    },
  });
  revalidatePath("/segmentos");
}

export async function refreshSegmentAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SEGMENTS_MANAGE);
  await estimateSegment(session.user.clinicId, String(formData.get("segmentId")));
  revalidatePath("/segmentos");
}

export async function recordConsentAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CONSENT_MANAGE);
  await recordConsent({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      patientId: String(formData.get("patientId")),
      purpose: String(formData.get("purpose") || "MARKETING") as
        | "TRANSACTIONAL"
        | "SERVICE"
        | "MARKETING"
        | "SURVEY"
        | "REFERRAL",
      channel: (String(formData.get("channel") || "") || null) as
        | "WHATSAPP"
        | "EMAIL"
        | "SMS"
        | "PUSH"
        | "INTERNAL"
        | null,
      accepted: formData.get("accepted") === "true" || formData.get("accepted") === "on",
      textAccepted: String(formData.get("textAccepted") || "") || null,
      version: String(formData.get("version") || "1"),
      origin: "admin",
    },
  });
  revalidatePath("/consentimentos");
}

export async function createTemplateAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.TEMPLATES_MANAGE);
  await createTemplate({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      code: String(formData.get("code") || ""),
      name: String(formData.get("name") || ""),
      channel: String(formData.get("channel") || "INTERNAL") as
        | "WHATSAPP"
        | "EMAIL"
        | "SMS"
        | "PUSH"
        | "INTERNAL",
      subject: String(formData.get("subject") || "") || null,
      body: String(formData.get("body") || ""),
      language: "pt-BR",
      footerOptOut: formData.get("footerOptOut") !== "off",
    },
  });
  revalidatePath("/templates");
}

export async function approveTemplateAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.TEMPLATES_APPROVE);
  await approveTemplate({
    clinicId: session.user.clinicId,
    templateId: String(formData.get("templateId")),
    actorId: session.user.id,
    status: String(formData.get("status")) === "REJECTED" ? "REJECTED" : "APPROVED",
  });
  revalidatePath("/templates");
}

export async function enqueueCommunicationAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.COMMUNICATIONS_SEND);
  await enqueueCommunication({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      patientId: String(formData.get("patientId")),
      channel: String(formData.get("channel") || "INTERNAL") as
        | "WHATSAPP"
        | "EMAIL"
        | "SMS"
        | "PUSH"
        | "INTERNAL",
      purpose: String(formData.get("purpose") || "SERVICE") as
        | "TRANSACTIONAL"
        | "SERVICE"
        | "MARKETING"
        | "SURVEY"
        | "REFERRAL",
      body: String(formData.get("body") || ""),
      subject: String(formData.get("subject") || "") || null,
      toAddress: String(formData.get("toAddress") || "") || null,
    },
  });
  revalidatePath("/comunicacoes");
}

export async function processQueueAction() {
  const session = await requirePermission(PERMISSIONS.COMMUNICATIONS_MANAGE);
  await processCommunicationQueue(session.user.clinicId);
  revalidatePath("/comunicacoes");
}

export async function createAutomationAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.AUTOMATIONS_MANAGE);
  await createAutomation({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      trigger: String(formData.get("trigger") || "PATIENT_REGISTERED") as
        | "PATIENT_REGISTERED"
        | "BIRTHDAY"
        | "BALANCE_EXPIRING"
        | "PATIENT_INACTIVE"
        | "PAYMENT_CONFIRMED"
        | "FIRST_APPOINTMENT"
        | "CASHBACK_RELEASED"
        | "POINTS_GRANTED"
        | "CATEGORY_CHANGED"
        | "BALANCE_EXPIRED"
        | "NPS_RESPONDED"
        | "REFERRAL_CREATED"
        | "REFERRAL_CONVERTED"
        | "VOUCHER_ISSUED"
        | "VOUCHER_EXPIRING"
        | "CAMPAIGN_STARTED"
        | "SCHEDULED",
      steps: [
        {
          actionType: String(formData.get("actionType") || "SEND_INTERNAL"),
          config: { body: String(formData.get("body") || "Olá {{nome_paciente}}") },
          delayMinutes: 0,
        },
      ],
    },
  });
  revalidatePath("/automacoes");
}

export async function setAutomationStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.AUTOMATIONS_MANAGE);
  await setAutomationStatus({
    clinicId: session.user.clinicId,
    automationId: String(formData.get("automationId")),
    status: String(formData.get("status")) as "ACTIVE" | "PAUSED" | "ARCHIVED" | "DRAFT",
    actorId: session.user.id,
  });
  revalidatePath("/automacoes");
}

export async function seedAutomationsAction() {
  const session = await requirePermission(PERMISSIONS.AUTOMATIONS_MANAGE);
  await seedPresetAutomations(session.user.clinicId);
  revalidatePath("/automacoes");
}

export async function duplicateAutomationAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.AUTOMATIONS_MANAGE);
  await duplicateAutomation({
    clinicId: session.user.clinicId,
    automationId: String(formData.get("automationId")),
    actorId: session.user.id,
  });
  revalidatePath("/automacoes");
}

export async function saveReferralProgramAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REFERRALS_MANAGE);
  await upsertReferralProgram({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || "Indique e ganhe"),
      referrerCashback: Number(formData.get("referrerCashback") || 0),
      referrerPoints: Number(formData.get("referrerPoints") || 0),
      referredCashback: Number(formData.get("referredCashback") || 0),
      referredPoints: Number(formData.get("referredPoints") || 0),
      minFirstAppointment: Number(formData.get("minFirstAppointment") || 0),
      conversionDays: Number(formData.get("conversionDays") || 90),
      periodDays: Number(formData.get("periodDays") || 30),
      benefitValidityDays: Number(formData.get("benefitValidityDays") || 90),
    },
  });
  revalidatePath("/indicacoes");
}

export async function createRewardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  await createReward({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      pointsCost: Number(formData.get("pointsCost") || 1),
      stockTotal: formData.get("stockTotal")
        ? Number(formData.get("stockTotal"))
        : null,
      limitPerPatient: formData.get("limitPerPatient")
        ? Number(formData.get("limitPerPatient"))
        : null,
      status: String(formData.get("status") || "ACTIVE") as
        | "DRAFT"
        | "ACTIVE"
        | "PAUSED"
        | "ENDED",
      rules: String(formData.get("rules") || "") || null,
    },
  });
  revalidatePath("/recompensas");
}

export async function redeemRewardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  await redeemReward({
    clinicId: session.user.clinicId,
    patientId: String(formData.get("patientId")),
    rewardId: String(formData.get("rewardId")),
    actorId: session.user.id,
    idempotencyKey: String(formData.get("idempotencyKey") || "") || undefined,
  });
  revalidatePath("/recompensas");
}

export async function fulfillRewardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_FULFILL);
  await fulfillReward({
    clinicId: session.user.clinicId,
    redemptionId: String(formData.get("redemptionId")),
    actorId: session.user.id,
  });
  revalidatePath("/recompensas");
}

export async function createVoucherAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.VOUCHERS_MANAGE);
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { ok: false as const, error: "Nome é obrigatório." };
    }
    const voucher = await createVoucher({
      clinicId: session.user.clinicId,
      actorId: session.user.id,
      data: {
        name,
        description: String(formData.get("description") || "") || null,
        type: String(formData.get("type") || "FIXED_VALUE") as
          | "FIXED_VALUE"
          | "PERCENT"
          | "PROCEDURE"
          | "GIFT"
          | "COURTESY"
          | "FEE"
          | "RECOVERY"
          | "BIRTHDAY",
        valueAmount: formData.get("valueAmount")
          ? Number(formData.get("valueAmount"))
          : null,
        valuePercent: formData.get("valuePercent")
          ? Number(formData.get("valuePercent"))
          : null,
        quantity: formData.get("quantity")
          ? Number(formData.get("quantity"))
          : null,
        maxUsesPerPatient: 1,
        multiUse: false,
        combineCashback: true,
        combineDiscount: false,
        status: "ACTIVE",
        expiresAt: formData.get("expiresAt")
          ? new Date(String(formData.get("expiresAt")))
          : null,
      },
    });
    revalidatePath("/vouchers");
    return {
      ok: true as const,
      voucher: toPlain({
        ...voucher,
        usedCount: 0,
        _count: { redemptions: 0 },
      }),
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Não foi possível emitir o cupom.",
    };
  }
}

export async function redeemVoucherAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.VOUCHERS_MANAGE);
    const code = String(formData.get("code") || "").trim();
    const patientId = String(formData.get("patientId") || "").trim();
    if (!code || !patientId) {
      return { ok: false as const, error: "Código e paciente são obrigatórios." };
    }
    await redeemVoucher({
      clinicId: session.user.clinicId,
      code,
      patientId,
      actorId: session.user.id,
    });
    revalidatePath("/vouchers");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível resgatar o cupom.",
    };
  }
}

export async function issueGiftCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.GIFTCARDS_MANAGE);
    const initialAmount = Number(formData.get("initialAmount") || 0);
    if (!Number.isFinite(initialAmount) || initialAmount <= 0) {
      return { ok: false as const, error: "Informe um valor válido." };
    }
    const card = await issueGiftCard({
      clinicId: session.user.clinicId,
      actorId: session.user.id,
      activate: formData.get("activate") === "on",
      data: {
        initialAmount,
        buyerName: String(formData.get("buyerName") || "") || null,
        beneficiaryName: String(formData.get("beneficiaryName") || "") || null,
        message: String(formData.get("message") || "") || null,
        allowPartial: formData.get("allowPartial") !== "off",
        expiresAt: formData.get("expiresAt")
          ? new Date(String(formData.get("expiresAt")))
          : null,
      },
    });
    revalidatePath("/vales-presente");
    return {
      ok: true as const,
      giftCard: toPlain({
        id: card.id,
        code: card.code,
        buyerName: card.buyerName,
        beneficiaryName: card.beneficiaryName,
        message: card.message,
        initialAmount: card.initialAmount,
        remainingAmount: card.remainingAmount,
        status: card.status,
        allowPartial: card.allowPartial,
        expiresAt: card.expiresAt,
        createdAt: card.createdAt,
      }),
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível emitir o vale-presente.",
    };
  }
}

export async function activateGiftCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.GIFTCARDS_MANAGE);
    const giftCardId = String(formData.get("giftCardId") || "").trim();
    if (!giftCardId) {
      return { ok: false as const, error: "Vale inválido." };
    }
    const card = await activateGiftCard({
      clinicId: session.user.clinicId,
      giftCardId,
      actorId: session.user.id,
    });
    revalidatePath("/vales-presente");
    return {
      ok: true as const,
      giftCard: toPlain({
        id: card.id,
        code: card.code,
        buyerName: card.buyerName,
        beneficiaryName: card.beneficiaryName,
        message: card.message,
        initialAmount: card.initialAmount,
        remainingAmount: card.remainingAmount,
        status: card.status,
        allowPartial: card.allowPartial,
        expiresAt: card.expiresAt,
        createdAt: card.createdAt,
      }),
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível ativar o vale-presente.",
    };
  }
}

export async function redeemGiftCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.GIFTCARDS_MANAGE);
    const code = String(formData.get("code") || "").trim();
    const amount = Number(formData.get("amount") || 0);
    if (!code) {
      return { ok: false as const, error: "Código é obrigatório." };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false as const, error: "Informe um valor válido." };
    }
    const card = await redeemGiftCard({
      clinicId: session.user.clinicId,
      code,
      amount,
      actorId: session.user.id,
    });
    revalidatePath("/vales-presente");
    return {
      ok: true as const,
      giftCard: toPlain({
        id: card.id,
        code: card.code,
        buyerName: card.buyerName,
        beneficiaryName: card.beneficiaryName,
        message: card.message,
        initialAmount: card.initialAmount,
        remainingAmount: card.remainingAmount,
        status: card.status,
        allowPartial: card.allowPartial,
        expiresAt: card.expiresAt,
        createdAt: card.createdAt,
      }),
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível debitar o vale-presente.",
    };
  }
}

export async function createAcceleratorAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.ACCELERATORS_MANAGE);
  await createAccelerator({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      multiplierPoints: formData.get("multiplierPoints")
        ? Number(formData.get("multiplierPoints"))
        : null,
      extraCashbackPct: formData.get("extraCashbackPct")
        ? Number(formData.get("extraCashbackPct"))
        : null,
      bonusFixed: formData.get("bonusFixed")
        ? Number(formData.get("bonusFixed"))
        : null,
      startsAt: new Date(String(formData.get("startsAt"))),
      endsAt: new Date(String(formData.get("endsAt"))),
      financialCap: formData.get("financialCap")
        ? Number(formData.get("financialCap"))
        : null,
      priority: Number(formData.get("priority") || 0),
      stackable: formData.get("stackable") === "on",
      active: true,
    },
  });
  revalidatePath("/aceleradores");
}

export async function runRecoveryAction() {
  const session = await requirePermission(PERMISSIONS.RECOVERY_MANAGE);
  await classifyInactivePatients(session.user.clinicId);
  revalidatePath("/recuperacao");
}

export async function createApiKeyAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE);
  await createApiCredential({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || "API Key"),
      environment: String(formData.get("environment") || "live") as "test" | "live",
      rateLimitRpm: Number(formData.get("rateLimitRpm") || 60),
    },
  });
  revalidatePath("/integracoes");
}

export async function revokeApiKeyAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE);
  await revokeApiCredential({
    clinicId: session.user.clinicId,
    credentialId: String(formData.get("credentialId")),
    actorId: session.user.id,
  });
  revalidatePath("/integracoes");
}

export async function createWebhookAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE);
  await createWebhookEndpoint({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      url: String(formData.get("url") || ""),
      events: String(formData.get("events") || "*")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
  });
  revalidatePath("/integracoes");
}

export async function completeOnboardingStepAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.ONBOARDING_MANAGE);
  await setOnboardingStep({
    clinicId: session.user.clinicId,
    step: String(formData.get("step")) as OnboardingStepCode,
    completed: formData.get("completed") !== "false",
    actorId: session.user.id,
    notes: String(formData.get("notes") || "") || undefined,
  });
  revalidatePath("/implantacao");
}

export async function createRaffleAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.RAFFLES_MANAGE);
  await createRaffle({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      ticketCostPoints: Number(formData.get("ticketCostPoints") || 50),
      maxTicketsPerPatient: formData.get("maxTicketsPerPatient")
        ? Number(formData.get("maxTicketsPerPatient"))
        : null,
      startsAt: new Date(String(formData.get("startsAt"))),
      endsAt: new Date(String(formData.get("endsAt"))),
      prizeDescription: String(formData.get("prizeDescription") || ""),
      prizeCashback: formData.get("prizeCashback")
        ? Number(formData.get("prizeCashback"))
        : null,
      prizePoints: formData.get("prizePoints")
        ? Number(formData.get("prizePoints"))
        : null,
      status: "DRAFT",
    },
  });
  revalidatePath("/sorteios");
}

export async function setRaffleStatusAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.RAFFLES_MANAGE);
  await setRaffleStatus({
    clinicId: session.user.clinicId,
    raffleId: String(formData.get("raffleId")),
    status: String(formData.get("status")) as RaffleStatus,
    actorId: session.user.id,
  });
  revalidatePath("/sorteios");
}

export async function drawRaffleAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.RAFFLES_MANAGE);
  await drawRaffle({
    clinicId: session.user.clinicId,
    raffleId: String(formData.get("raffleId")),
    actorId: session.user.id,
  });
  revalidatePath("/sorteios");
}

export async function submitReceiptAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.RECEIPTS_MANAGE);
  await submitReceipt({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    data: {
      patientId: String(formData.get("patientId")),
      imageUrl: String(formData.get("imageUrl") || "") || null,
      declaredAmount: formData.get("declaredAmount")
        ? Number(formData.get("declaredAmount"))
        : null,
      merchantName: String(formData.get("merchantName") || "") || null,
      idempotencyKey: `receipt:${Date.now()}`,
    },
  });
  revalidatePath("/comprovantes");
}

export async function reviewReceiptAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.RECEIPTS_MANAGE);
  await reviewReceipt({
    clinicId: session.user.clinicId,
    receiptId: String(formData.get("receiptId")),
    actorId: session.user.id,
    decision: String(formData.get("decision")) as "APPROVED" | "REJECTED",
    creditAmount: formData.get("creditAmount")
      ? Number(formData.get("creditAmount"))
      : undefined,
  });
  revalidatePath("/comprovantes");
}

export async function runPredictionsAction() {
  const session = await requirePermission(PERMISSIONS.PREDICTIVE_VIEW);
  await computePatientPredictions(session.user.clinicId);
  revalidatePath("/preditivo");
}

export async function runForecastAction() {
  const session = await requirePermission(PERMISSIONS.PREDICTIVE_VIEW);
  await forecastRevenue(session.user.clinicId, 3);
  revalidatePath("/preditivo");
}

export async function addWidgetOriginAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE);
  await addWidgetOrigin({
    clinicId: session.user.clinicId,
    actorId: session.user.id,
    origin: String(formData.get("origin") || ""),
  });
  revalidatePath("/integracoes");
}

export async function updateCustomDomainAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const customDomain = String(formData.get("customDomain") || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  await prisma.clinic.update({
    where: { id: session.user.clinicId },
    data: { customDomain: customDomain || null },
  });

  revalidatePath("/configuracoes");
}

export async function staffExportPatientLgpdAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const patientId = String(formData.get("patientId") || "");
  const { exportPatientData } = await import("@/lib/lgpd");
  return exportPatientData({
    clinicId: session.user.clinicId,
    patientId,
    actorId: session.user.id,
  });
}

export async function staffAnonymizePatientLgpdAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_WRITE);
  const patientId = String(formData.get("patientId") || "");
  const { anonymizePatient } = await import("@/lib/lgpd");
  const { revokeAllMobileSessionsForPatient } = await import(
    "@/lib/mobile/session"
  );
  await anonymizePatient({
    clinicId: session.user.clinicId,
    patientId,
    actorId: session.user.id,
    reason: "solicitacao_staff",
  });
  await revokeAllMobileSessionsForPatient({
    clinicId: session.user.clinicId,
    patientId,
  });
  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/pacientes");
}
