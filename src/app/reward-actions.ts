"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  createReward,
  fulfillReward,
  redeemReward,
  rewardSchema,
  setRewardStatus,
  updateReward,
} from "@/lib/rewards";
import { toPlain } from "@/lib/serialize";

function parseRewardForm(formData: FormData) {
  const stockRaw = String(formData.get("stockTotal") || "").trim();
  const limitRaw = String(formData.get("limitPerPatient") || "").trim();

  return rewardSchema.parse({
    name: formData.get("name"),
    description: String(formData.get("description") || "") || null,
    pointsCost: formData.get("pointsCost"),
    stockTotal: stockRaw === "" ? null : stockRaw,
    limitPerPatient: limitRaw === "" ? null : limitRaw,
    status: String(formData.get("status") || "ACTIVE"),
    rules: String(formData.get("rules") || "") || null,
  });
}

function revalidateRewards() {
  revalidatePath("/recompensas");
}

export async function createRewardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  const data = parseRewardForm(formData);
  const reward = await createReward({
    clinicId: session.clinicId,
    actorId: session.user.id,
    data,
  });
  revalidateRewards();
  return { ok: true as const, reward: toPlain(reward) };
}

export async function updateRewardAction(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  const data = parseRewardForm(formData);
  const reward = await updateReward({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    data,
  });
  revalidateRewards();
  return { ok: true as const, reward: toPlain(reward) };
}

export async function setRewardStatusAction(
  id: string,
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED",
) {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  const reward = await setRewardStatus({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    status,
  });
  revalidateRewards();
  return { ok: true as const, reward: toPlain(reward) };
}

export async function redeemRewardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  const redemption = await redeemReward({
    clinicId: session.clinicId,
    patientId: String(formData.get("patientId")),
    rewardId: String(formData.get("rewardId")),
    actorId: session.user.id,
    idempotencyKey: String(formData.get("idempotencyKey") || "") || undefined,
  });
  revalidateRewards();
  return { ok: true as const, redemption: toPlain(redemption) };
}

export async function fulfillRewardAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.REWARDS_FULFILL);
  const redemption = await fulfillReward({
    clinicId: session.clinicId,
    redemptionId: String(formData.get("redemptionId")),
    actorId: session.user.id,
  });
  revalidateRewards();
  return { ok: true as const, redemption: toPlain(redemption) };
}
