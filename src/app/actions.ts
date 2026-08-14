"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createPatient, updatePatient, patientSchema } from "@/lib/patients";
import { onlyDigits } from "@/lib/patients/cpf";
import { linkCard, blockCard, createCardStock, unblockCard, replaceCard, issueVirtualCard, saveCardSettings, searchPatientsForCardLink } from "@/lib/cards";
import { confirmAppointment, getAppointmentSale, updateAppointmentSale } from "@/lib/reception";
import { simulateBenefit, applyGiftCardToSimulation, campaignIsAvailableForPatient } from "@/lib/cashback";
import { prisma } from "@/lib/db";
import { saveBenefitSettings, type BenefitSettings } from "@/lib/cashback";
import { reverseLedgerEntry } from "@/lib/ledger";
import { writeAuditLog } from "@/lib/audit";
import { toPlain } from "@/lib/serialize";
import { z } from "zod";
import { lookupGiftCard, quoteGiftCardForSale } from "@/lib/giftcards";
import { headers } from "next/headers";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/lib/auth/password-reset";
import {
  HEADER_ORG_SLUG,
  resolverHost,
} from "@/lib/organization-host";

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
    organizationId: session.organizationId,
    data,
  });

  revalidatePath("/pacientes");
  return { ok: true as const, patientId: patient.id };
}

function redirectErroCadastroPaciente(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  const zodIssues =
    err instanceof z.ZodError
      ? err.issues
      : err &&
          typeof err === "object" &&
          "issues" in err &&
          Array.isArray((err as { issues: unknown }).issues)
        ? (err as z.ZodError).issues
        : null;

  if (zodIssues?.length) {
    const detalhe = zodIssues[0]?.message ?? "Dados inválidos";
    redirect(
      `/pacientes/novo?erro=validacao&detalhe=${encodeURIComponent(detalhe)}`,
    );
  }
  if (/pool timeout|P2039|acquireTimeout|Can't connect|ECONNREFUSED/i.test(msg)) {
    redirect("/pacientes/novo?erro=banco-indisponivel");
  }
  if (/Illegal mix of collations|1267/i.test(msg)) {
    redirect(
      `/pacientes/novo?erro=validacao&detalhe=${encodeURIComponent(
        "Falha de collation no MySQL. Reinicie o servidor local (npm run dev) e tente de novo.",
      )}`,
    );
  }
  if (
    name === "SemContextoTenantError" ||
    /sem contexto de organização/i.test(msg)
  ) {
    redirect("/pacientes/novo?erro=sessao-org");
  }
  if (/Já existe paciente com este CPF/i.test(msg)) {
    redirect("/pacientes/novo?erro=cpf-duplicado");
  }
  if (
    name === "PlanLimitError" ||
    /Limite do plano|Organização suspensa|trial encerrado/i.test(msg)
  ) {
    redirect("/pacientes/novo?erro=limite-plano");
  }
  if (/Foreign key constraint|clinicId|userId/i.test(msg)) {
    redirect("/pacientes/novo?erro=sessao-org");
  }
  redirect("/pacientes/novo?erro=cadastro-falhou");
}

/** Action de formulário: cria e redireciona (evita inline "use server" na page). */
export async function createPatientFormAction(formData: FormData) {
  try {
    const result = await createPatientAction(formData);
    redirect(`/pacientes/${result.patientId}`);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[createPatientFormAction]", err);
    redirectErroCadastroPaciente(err);
  }
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
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    const quantity = Number(formData.get("quantity") || 0);
    const unitId = String(formData.get("unitId") || "") || null;
    const prefix = String(formData.get("prefix") || "").trim() || undefined;
    const validityRaw = String(formData.get("validityDays") || "").trim();
    const validityDays = validityRaw ? Number(validityRaw) : undefined;
    const result = await createCardStock({
      clinicId: session.clinicId,
      unitId,
      quantity,
      prefix,
      validityDays,
      actorId: session.user.id,
    });
    revalidatePath("/cartoes");
    return { ok: true as const, count: result.count };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Não foi possível gerar o estoque.",
    };
  }
}

export async function linkCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    const publicToken = String(formData.get("publicToken") || "");
    const walletId = String(formData.get("walletId") || "");
    await linkCard({
      clinicId: session.clinicId,
      publicToken,
      walletId,
      actorId: session.user.id,
    });
    revalidatePath("/cartoes");
    revalidatePath("/recepcao");
    revalidatePath("/pacientes");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Não foi possível vincular o cartão.",
    };
  }
}

/** Compatível com <form action={...}> (React exige Promise<void>). */
export async function linkCardFormAction(formData: FormData): Promise<void> {
  await linkCardAction(formData);
}

export async function blockCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    await blockCard({
      clinicId: session.clinicId,
      cardId: String(formData.get("cardId") || ""),
      actorId: session.user.id,
      reason: String(formData.get("reason") || "Bloqueio administrativo"),
    });
    revalidatePath("/cartoes");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Não foi possível bloquear o cartão.",
    };
  }
}

export async function unblockCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    await unblockCard({
      clinicId: session.clinicId,
      cardId: String(formData.get("cardId") || ""),
      actorId: session.user.id,
      reason: String(formData.get("reason") || "") || undefined,
    });
    revalidatePath("/cartoes");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível desbloquear o cartão.",
    };
  }
}

export async function replaceCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    await replaceCard({
      clinicId: session.clinicId,
      oldCardId: String(formData.get("oldCardId") || ""),
      newCardId: String(formData.get("newCardId") || "") || null,
      newPublicToken: String(formData.get("newPublicToken") || "") || null,
      actorId: session.user.id,
      reason: String(formData.get("reason") || "") || undefined,
    });
    revalidatePath("/cartoes");
    revalidatePath("/pacientes");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível emitir a 2ª via.",
    };
  }
}

export async function issueVirtualCardAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    const walletId = String(formData.get("walletId") || "");
    const validityRaw = String(formData.get("validityDays") || "").trim();
    const card = await issueVirtualCard({
      clinicId: session.clinicId,
      walletId,
      actorId: session.user.id,
      validityDays: validityRaw ? Number(validityRaw) : undefined,
    });
    revalidatePath("/cartoes");
    revalidatePath("/pacientes");
    return { ok: true as const, cardId: card.id, cardNumber: card.cardNumber };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível emitir o cartão virtual.",
    };
  }
}

export async function saveCardSettingsAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
    const validityRaw = String(formData.get("defaultValidityDays") || "").trim();
    await saveCardSettings(session.clinicId, {
      prefix: String(formData.get("prefix") || "DERM"),
      lowStockThreshold: Number(formData.get("lowStockThreshold") || 20),
      defaultValidityDays: validityRaw ? Number(validityRaw) : null,
    });
    revalidatePath("/cartoes");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações.",
    };
  }
}

export async function searchPatientsForCardAction(query: string) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const results = await searchPatientsForCardLink(session.clinicId, query);
  return { ok: true as const, results };
}

export async function simulateReceptionAction(input: {
  walletId: string;
  procedureId?: string;
  campaignId?: string;
  grossAmount: number;
  discountAmount?: number;
  benefitToUse?: number;
  giftCardCode?: string;
  giftCardAmount?: number;
  editingAppointmentId?: string;
  items?: Array<{
    procedureId?: string;
    unitPrice: number;
    quantity: number;
  }>;
}) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const wallet = await prisma.wallet.findFirst({
    where: { id: input.walletId, clinicId: session.user.clinicId },
    include: { category: true },
  });
  if (!wallet) throw new Error("Carteira não encontrada");

  const cartItems = input.items ?? [];
  const procedureIds = [
    ...new Set(
      [
        input.procedureId,
        ...cartItems.map((i) => i.procedureId),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const procedures = procedureIds.length
    ? await prisma.procedure.findMany({
        where: { clinicId: session.user.clinicId, id: { in: procedureIds } },
      })
    : [];
  const byId = Object.fromEntries(procedures.map((p) => [p.id, p]));

  let procedureCashbackPercent: number | null = null;
  let grossAmount = input.grossAmount;
  if (cartItems.length > 0) {
    grossAmount = cartItems.reduce(
      (sum, i) => sum + Number(i.unitPrice) * Math.max(1, Math.trunc(i.quantity || 1)),
      0,
    );
    let weight = 0;
    let total = 0;
    for (const item of cartItems) {
      const qty = Math.max(1, Math.trunc(item.quantity || 1));
      const line = Number(item.unitPrice) * qty;
      total += line;
      const pct = item.procedureId
        ? byId[item.procedureId]?.cashbackPercent
        : null;
      if (pct != null) weight += line * Number(pct);
    }
    procedureCashbackPercent = total > 0 && weight > 0 ? weight / total : null;
  } else if (input.procedureId && byId[input.procedureId]?.cashbackPercent != null) {
    procedureCashbackPercent = Number(byId[input.procedureId].cashbackPercent);
  }

  const campaign = input.campaignId
    ? await prisma.campaign.findFirst({
        where: { id: input.campaignId, clinicId: session.user.clinicId },
      })
    : null;
  const campaignAllowed =
    campaign &&
    (await campaignIsAvailableForPatient(
      prisma,
      campaign,
      wallet.patientId,
    ));

  let availableBalance = Number(wallet.availableBalance);
  if (input.editingAppointmentId) {
    const editing = await prisma.appointment.findFirst({
      where: {
        id: input.editingAppointmentId,
        clinicId: session.user.clinicId,
        walletId: wallet.id,
        status: "CONFIRMED",
      },
      select: { benefitUsed: true },
    });
    if (editing) {
      availableBalance += Number(editing.benefitUsed);
    }
  }

  const simulation = await simulateBenefit({
    clinicId: session.user.clinicId,
    patientId: wallet.patientId,
    excludeAppointmentId: input.editingAppointmentId,
    categoryCashbackPercent: wallet.category
      ? Number(wallet.category.cashbackPercent)
      : null,
    procedureCashbackPercent,
    campaignExtraPercent:
      campaign && campaignAllowed
        ? Number(campaign.extraCashbackPct)
        : null,
    grossAmount,
    discountAmount: input.discountAmount,
    benefitToUse: input.benefitToUse,
    availableBalance,
  });

  const code = input.giftCardCode?.trim();
  if (!code) return simulation;

  const quote = await quoteGiftCardForSale({
    clinicId: session.user.clinicId,
    code,
    amountDue: Number(simulation.paidAmount),
    requestedAmount: input.giftCardAmount,
    creditBackAppointmentId: input.editingAppointmentId,
  });
  return applyGiftCardToSimulation(simulation, quote.amount, quote.card.code);
}

export async function lookupReceptionGiftCardAction(
  code: string,
  editingAppointmentId?: string,
) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const card = await lookupGiftCard({
    clinicId: session.user.clinicId,
    code,
    creditBackAppointmentId: editingAppointmentId,
  });
  return toPlain(card);
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
  giftCardCode?: string;
  giftCardAmount?: number;
  paymentMethod?: string;
  items?: Array<{
    procedureId?: string;
    name: string;
    unitPrice: number;
    quantity: number;
    professionalName?: string | null;
  }>;
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
    giftCardCode: input.giftCardCode,
    giftCardAmount: input.giftCardAmount,
    paymentMethod: input.paymentMethod,
    items: input.items,
  });
  revalidatePath("/recepcao");
  revalidatePath("/dashboard");
  revalidatePath("/vales-presente");
  revalidatePath("/extrato-dia");
  return toPlain(result);
}

export async function getSaleForEditAction(appointmentId: string) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const sale = await getAppointmentSale({
    clinicId: session.user.clinicId,
    appointmentId,
  });
  return toPlain(sale);
}

export async function updateReceptionSaleAction(input: {
  appointmentId: string;
  campaignId?: string;
  discountAmount?: number;
  benefitToUse?: number;
  professionalName?: string;
  giftCardCode?: string;
  giftCardAmount?: number;
  paymentMethod?: string;
  items: Array<{
    procedureId?: string;
    name: string;
    unitPrice: number;
    quantity: number;
    professionalName?: string | null;
  }>;
}) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const result = await updateAppointmentSale({
    clinicId: session.user.clinicId,
    unitId: session.user.unitId,
    appointmentId: input.appointmentId,
    operatorId: session.user.id,
    professionalName: input.professionalName,
    discountAmount: input.discountAmount,
    benefitToUse: input.benefitToUse,
    campaignId: input.campaignId,
    giftCardCode: input.giftCardCode,
    giftCardAmount: input.giftCardAmount,
    paymentMethod: input.paymentMethod,
    items: input.items,
  });
  revalidatePath("/recepcao");
  revalidatePath("/dashboard");
  revalidatePath(`/pacientes`);
  revalidatePath("/vales-presente");
  revalidatePath("/extrato-dia");
  revalidatePath(`/extrato-dia/${input.appointmentId}`);
  return toPlain(result);
}

function mensagemErroAcao(error: unknown, fallback: string) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (/pool timeout|Can't connect|ECONNREFUSED|ETIMEDOUT/i.test(raw)) {
    return "Banco de dados indisponível ou lento. Verifique o MySQL (WAMP) e tente de novo.";
  }
  if (/SemContextoTenantError|sem contexto de organização/i.test(raw)) {
    return "Sessão sem organização. Faça login novamente.";
  }
  return fallback;
}

function sanitizarSettings(settings: BenefitSettings): BenefitSettings {
  const num = (v: number, fallback: number) =>
    Number.isFinite(v) ? v : fallback;
  const numOrNull = (v: number | null) =>
    v == null || !Number.isFinite(v) ? null : v;

  return {
    defaultCashbackPercent: num(settings.defaultCashbackPercent, 0),
    pointsPerReal: num(settings.pointsPerReal, 0),
    releaseDays: Math.max(0, Math.trunc(num(settings.releaseDays, 0))),
    validityDays: Math.max(1, Math.trunc(num(settings.validityDays, 180))),
    maxCashbackPerTransaction: numOrNull(settings.maxCashbackPerTransaction),
    maxRedemptionPercent: numOrNull(settings.maxRedemptionPercent),
    maxCashbackPerPatientPeriod: numOrNull(
      settings.maxCashbackPerPatientPeriod,
    ),
    cashbackPeriodDays: Math.max(
      1,
      Math.trunc(num(settings.cashbackPeriodDays, 30)),
    ),
  };
}

export async function saveSettingsAction(settings: BenefitSettings) {
  try {
    const session = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const clean = sanitizarSettings(settings);
    await saveBenefitSettings(session.user.clinicId, clean);
    await writeAuditLog({
      clinicId: session.user.clinicId,
      userId: session.user.id,
      action: "SETTINGS_CHANGE",
      entityType: "Setting",
      afterData: JSON.parse(JSON.stringify(clean)),
    });
    revalidatePath("/configuracoes");
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      error: mensagemErroAcao(error, "Não foi possível salvar as configurações."),
    };
  }
}

export async function saveCategoryAction(formData: FormData) {
  try {
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

    if (!payload.name.trim() || !payload.slug.trim()) {
      return { ok: false as const, error: "Nome e slug são obrigatórios." };
    }

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
    return { ok: true as const };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      error: mensagemErroAcao(error, "Não foi possível salvar o plano."),
    };
  }
}

export async function saveCampaignAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE);
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return { ok: false as const, error: "Nome é obrigatório." };
    }

    const data = {
      name,
      description: String(formData.get("description") || "") || null,
      status: String(formData.get("status") || "DRAFT") as
        | "DRAFT"
        | "SCHEDULED"
        | "ACTIVE"
        | "ENDED"
        | "CANCELLED",
      extraCashbackPct: String(formData.get("extraCashbackPct") || "0"),
      extraPoints: Math.max(0, Math.trunc(Number(formData.get("extraPoints") || 0))),
      benefitDescription:
        String(formData.get("benefitDescription") || "") || null,
      couponCode: String(formData.get("couponCode") || "").trim() || null,
      startsAt: formData.get("startsAt")
        ? new Date(String(formData.get("startsAt")))
        : null,
      endsAt: formData.get("endsAt")
        ? new Date(String(formData.get("endsAt")))
        : null,
    };

    let campaign;
    if (id) {
      const existing = await prisma.campaign.findFirst({
        where: { id, clinicId: session.user.clinicId },
        select: { id: true },
      });
      if (!existing) {
        return { ok: false as const, error: "Campanha não encontrada." };
      }
      campaign = await prisma.campaign.update({ where: { id }, data });
    } else {
      campaign = await prisma.campaign.create({
        data: { clinicId: session.user.clinicId, ...data },
      });
    }

    revalidatePath("/campanhas");
    return { ok: true as const, campaign: toPlain(campaign) };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false as const,
      error: mensagemErroAcao(error, "Não foi possível salvar a campanha."),
    };
  }
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

function clientIp(h: Headers) {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

function trustedBaseHost(): string | null {
  const base = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return null;
  try {
    return new URL(base).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Origem usada no link de e-mail de redefinição de senha. NUNCA confiar
 * cegamente no cabeçalho `Host` — ele é enviado pelo cliente e
 * `resolverHost()` só valida o formato do primeiro rótulo (ex.:
 * "dermaphios.atacante.com" também seria classificado "organizacao"), então
 * usar o Host bruto aqui permite envenenar o link do reset de senha
 * (CWE-640) com um domínio controlado pelo atacante. Só confiamos no Host
 * quando ele realmente é subdomínio do domínio configurado em
 * AUTH_URL/NEXT_PUBLIC_APP_URL (ou é localhost em dev); caso contrário caímos
 * nessa variável de ambiente, que é confiável por não vir da requisição.
 */
function requestOrigin(
  h: Headers,
  hostTipo: "organizacao" | "plataforma" | "indefinido",
) {
  const trustedFallback = (
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  if (hostTipo !== "organizacao") return trustedFallback;

  const host = h.get("host");
  if (!host) return trustedFallback;
  const hostSemPorta = host.split(":")[0]!.toLowerCase();

  const ehDevLocal =
    process.env.NODE_ENV !== "production" &&
    (hostSemPorta === "localhost" || hostSemPorta.endsWith(".localhost"));

  const baseHost = trustedBaseHost();
  const ehSubdominioConfiavel =
    ehDevLocal ||
    (baseHost != null &&
      (hostSemPorta === baseHost || hostSemPorta.endsWith(`.${baseHost}`)));

  if (!ehSubdominioConfiavel) return trustedFallback;

  const proto =
    h.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export async function requestPasswordResetAction(input: {
  email: string;
  organizationSlug?: string;
}) {
  const h = await headers();
  const host = resolverHost(h.get("host"));
  const slugHeader = h.get(HEADER_ORG_SLUG);
  const organizationSlug =
    host.tipo === "organizacao"
      ? host.slug
      : host.tipo === "plataforma"
        ? ""
        : input.organizationSlug || slugHeader || "";

  return requestPasswordReset({
    email: input.email,
    organizationSlug,
    hostTipo: host.tipo,
    origin: requestOrigin(h, host.tipo),
    ip: clientIp(h),
  });
}

export async function confirmPasswordResetAction(input: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  const h = await headers();
  return confirmPasswordReset({
    token: input.token,
    password: input.password,
    confirmPassword: input.confirmPassword,
    ip: clientIp(h),
  });
}

export async function searchPatientsAction(query: string) {
  const session = await requirePermission(PERMISSIONS.PATIENTS_READ);
  const q = query.trim();
  if (!q) return [];

  const digits = onlyDigits(q);

  const rows = await prisma.patient.findMany({
    where: {
      clinicId: session.user.clinicId,
      status: { not: "BLOCKED" },
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
    orderBy: { fullName: "asc" },
    take: 20,
  });

  // Garante unicidade por id (evita surpresa visual se o include multiplicar)
  const seen = new Set<string>();
  const unique = rows.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return toPlain(unique);
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
        items: {
          select: { id: true, name: true, quantity: true, lineTotal: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
  );
}
