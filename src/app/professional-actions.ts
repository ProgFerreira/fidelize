"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  createProfessional,
  professionalSchema,
  setProfessionalActive,
  updateProfessional,
} from "@/lib/professionals";
import { toPlain } from "@/lib/serialize";

function procedureIdsFromForm(formData: FormData) {
  return formData
    .getAll("procedureIds")
    .map(String)
    .map((v) => v.trim())
    .filter(Boolean);
}

function procedurePricesFromForm(formData: FormData, procedureIds: string[]) {
  const prices: Record<string, string | null> = {};
  for (const id of procedureIds) {
    const raw = String(formData.get(`procedurePrice_${id}`) ?? "").trim();
    prices[id] = raw === "" ? null : raw.replace(",", ".");
  }
  return prices;
}

function parseProfessionalForm(formData: FormData) {
  const procedureIds = procedureIdsFromForm(formData);
  return professionalSchema.parse({
    name: formData.get("name"),
    specialty: formData.get("specialty"),
    notes: String(formData.get("notes") || "") || null,
    active: formData.get("active") === "on" || formData.get("active") === "true",
    color: String(formData.get("color") || "") || null,
    procedureIds,
    procedurePrices: procedurePricesFromForm(formData, procedureIds),
  });
}

function revalidateProfessionals() {
  revalidatePath("/profissionais");
  revalidatePath("/agenda");
  revalidatePath("/recepcao");
  revalidatePath("/servicos");
}

export async function createProfessionalAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE);
  const data = parseProfessionalForm(formData);
  const professional = await createProfessional({
    clinicId: session.clinicId,
    actorId: session.user.id,
    unitId: session.unitId,
    data,
  });
  revalidateProfessionals();
  return { ok: true as const, professional: toPlain(professional) };
}

export async function updateProfessionalAction(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE);
  const data = parseProfessionalForm(formData);
  const professional = await updateProfessional({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    data,
  });
  revalidateProfessionals();
  return { ok: true as const, professional: toPlain(professional) };
}

export async function toggleProfessionalActiveAction(
  id: string,
  active: boolean,
) {
  const session = await requirePermission(PERMISSIONS.PROFESSIONALS_MANAGE);
  await setProfessionalActive({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    active,
  });
  revalidateProfessionals();
  return { ok: true as const };
}
