"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAffiliateSession, requirePlatformAdmin } from "@/lib/auth/guards";
import {
  blockOrCancelCommission,
  cancelOrRefundPlatformSale,
  confirmPlatformSale,
  createAffiliate,
  createAffiliatePayout,
  linkReferralToOrganization,
  updateAffiliateProfile,
  updateAffiliateStatus,
  updateAffiliateCommissionPlan,
} from "@/lib/affiliates";
import { saveAffiliatePayoutReceipt } from "@/lib/uploads/affiliate-payout-receipt";
import type { AffiliateStatus } from "@/generated/prisma/client";

export async function createAffiliateAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  const result = await createAffiliate({
    actorId: session.user.id,
    data: {
      type: (String(formData.get("type") || "AFFILIATE") as "AFFILIATE" | "PARTNER"),
      name: String(formData.get("name") || ""),
      document: String(formData.get("document") || "") || null,
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || "") || null,
      pixKey: String(formData.get("pixKey") || "") || null,
      password: String(formData.get("password") || "") || undefined,
      termsAccepted: formData.get("termsAccepted") === "on",
    },
  });
  void result;
  revalidatePath("/organizacoes/afiliados");
}

export async function updateAffiliateStatusAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  const status = String(formData.get("status") || "") as AffiliateStatus;
  await updateAffiliateStatus({
    affiliateId: String(formData.get("affiliateId") || ""),
    status,
    actorId: session.user.id,
    reason: String(formData.get("reason") || "") || undefined,
  });
  revalidatePath("/organizacoes/afiliados");
}

export async function changeAffiliatePlanAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  await updateAffiliateCommissionPlan({
    affiliateId: String(formData.get("affiliateId") || ""),
    commissionPlanId: String(formData.get("commissionPlanId") || ""),
    actorId: session.user.id,
    reason: String(formData.get("reason") || "") || undefined,
  });
  revalidatePath("/organizacoes/afiliados");
}

export async function linkReferralAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  await linkReferralToOrganization({
    organizationId: String(formData.get("organizationId") || ""),
    affiliateCode: String(formData.get("affiliateCode") || "") || undefined,
    affiliateId: String(formData.get("affiliateId") || "") || undefined,
    source: "ADMIN",
    actorId: session.user.id,
    reason: String(formData.get("reason") || ""),
  });
  revalidatePath("/organizacoes/afiliados");
}

export async function confirmPlatformSaleAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const planCode = String(formData.get("planCode") || "start");
  const gross = String(formData.get("grossAmount") || "0");
  const discount = String(formData.get("discountAmount") || "0");
  const key =
    String(formData.get("idempotencyKey") || "") ||
    `sale:${organizationId}:${planCode}:${Date.now()}`;

  const result = await confirmPlatformSale({
    organizationId,
    planCode,
    grossAmount: gross,
    discountAmount: discount,
    idempotencyKey: key,
    actorId: session.user.id,
    notes: String(formData.get("notes") || "") || null,
  });
  void result;
  revalidatePath("/organizacoes/afiliados");
}

export async function cancelPlatformSaleAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  await cancelOrRefundPlatformSale({
    saleId: String(formData.get("saleId") || ""),
    actorId: session.user.id,
    reason: String(formData.get("reason") || "Cancelamento administrativo"),
    asRefund: formData.get("asRefund") === "on",
  });
  revalidatePath("/organizacoes/afiliados");
}

export async function blockCommissionAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  await blockOrCancelCommission({
    commissionId: String(formData.get("commissionId") || ""),
    actorId: session.user.id,
    action: formData.get("action") === "CANCEL" ? "CANCEL" : "BLOCK",
    reason: String(formData.get("reason") || ""),
  });
  revalidatePath("/organizacoes/afiliados");
}

export async function createPayoutAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  const affiliateId = String(formData.get("affiliateId") || "");
  const commissionIds = formData
    .getAll("commissionIds")
    .map((v) => String(v))
    .filter(Boolean);

  let receiptPath: string | null = null;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    receiptPath = await saveAffiliatePayoutReceipt({ affiliateId, file });
  }

  await createAffiliatePayout({
    affiliateId,
    commissionIds,
    actorId: session.user.id,
    method: String(formData.get("method") || "pix"),
    notes: String(formData.get("notes") || "") || null,
    receiptPath,
  });
  revalidatePath("/organizacoes/afiliados");
}

export async function updateAffiliateProfileAction(formData: FormData) {
  const session = await requireAffiliateSession();
  await updateAffiliateProfile({
    affiliateId: session.affiliateId,
    actorId: session.user.id,
    data: {
      name: String(formData.get("name") || "") || undefined,
      phone: String(formData.get("phone") || "") || null,
      pixKey: String(formData.get("pixKey") || "") || null,
      payoutNotes: String(formData.get("payoutNotes") || "") || null,
    },
  });
  revalidatePath("/afiliado");
  redirect("/afiliado/perfil?ok=salvo");
}
