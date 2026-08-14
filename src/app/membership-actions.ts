"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  confirmMembershipPayment,
  membershipPlanSchema,
  subscribeMembership,
  upsertMembershipPlan,
} from "@/lib/membership";

function revalidateClub() {
  revalidatePath("/clube-vip");
  revalidatePath("/p/clube");
  revalidatePath("/recepcao");
}

export async function upsertMembershipPlanAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const id = String(formData.get("id") || "").trim() || undefined;
  const data = membershipPlanSchema.parse({
    name: formData.get("name"),
    monthlyPrice: formData.get("monthlyPrice"),
    extraCashbackPct: formData.get("extraCashbackPct") || 0,
    courtesyNote: String(formData.get("courtesyNote") || "") || null,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  await upsertMembershipPlan({ clinicId: session.clinicId, id, data });
  revalidateClub();
}

export async function subscribeMembershipAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const method = String(formData.get("paidMethod") || "PIX") as
    | "PIX"
    | "DINHEIRO"
    | "CORTESIA";
  await subscribeMembership({
    clinicId: session.clinicId,
    patientId: String(formData.get("patientId") || ""),
    planId: String(formData.get("planId") || ""),
    paidMethod: method,
    confirmPayment: method !== "PIX" || formData.get("confirmNow") === "on",
  });
  revalidateClub();
}

export async function confirmMembershipPaymentAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  await confirmMembershipPayment({
    clinicId: session.clinicId,
    membershipId: String(formData.get("membershipId") || ""),
  });
  revalidateClub();
}
