"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  createService,
  serviceSchema,
  setServiceActive,
  updateService,
} from "@/lib/services";
import { saveServiceImage } from "@/lib/uploads/service-image";
import { toPlain } from "@/lib/serialize";

function parseServiceForm(formData: FormData, imageUrl: string | null) {
  const validityRaw = String(formData.get("validityDays") || "").trim();
  const durationRaw = String(formData.get("durationMinutes") || "").trim();
  const cashbackRaw = String(formData.get("cashbackPercent") || "").trim();
  const pointsRaw = String(formData.get("pointsPerReal") || "").trim();

  return serviceSchema.parse({
    name: formData.get("name"),
    code: String(formData.get("code") || "") || null,
    description: String(formData.get("description") || "") || null,
    imageUrl,
    basePrice: formData.get("basePrice"),
    compareAtPrice: String(formData.get("compareAtPrice") || "").trim() || null,
    validityDays: validityRaw === "" ? null : validityRaw,
    durationMinutes: durationRaw === "" ? 60 : durationRaw,
    cashbackPercent: cashbackRaw === "" ? null : cashbackRaw,
    pointsPerReal: pointsRaw === "" ? null : pointsRaw,
    eligible: formData.get("eligible") === "true",
    active: formData.get("active") === "true",
  });
}

async function resolveImageUrl(
  clinicId: string,
  formData: FormData,
): Promise<string | null> {
  const remove = formData.get("removeImage") === "true";
  if (remove) return null;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    return saveServiceImage({ clinicId, file });
  }

  const current = String(formData.get("imageUrl") || "").trim();
  return current || null;
}

function revalidateServices() {
  revalidatePath("/servicos");
  revalidatePath("/profissionais");
  revalidatePath("/agenda");
  revalidatePath("/recepcao");
  revalidatePath("/configuracoes");
}

export async function createServiceAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SERVICES_MANAGE);
  const imageUrl = await resolveImageUrl(session.clinicId, formData);
  const data = parseServiceForm(formData, imageUrl);
  const service = await createService({
    clinicId: session.clinicId,
    actorId: session.user.id,
    data,
  });
  revalidateServices();
  return { ok: true as const, service: toPlain(service) };
}

export async function updateServiceAction(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.SERVICES_MANAGE);
  const imageUrl = await resolveImageUrl(session.clinicId, formData);
  const data = parseServiceForm(formData, imageUrl);
  const service = await updateService({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    data,
  });
  revalidateServices();
  return { ok: true as const, service: toPlain(service) };
}

export async function toggleServiceActiveAction(id: string, active: boolean) {
  const session = await requirePermission(PERMISSIONS.SERVICES_MANAGE);
  await setServiceActive({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    active,
  });
  revalidateServices();
  return { ok: true as const };
}
