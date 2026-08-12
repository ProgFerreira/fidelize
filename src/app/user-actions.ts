"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  createStaffUser,
  resetStaffUserPassword,
  setStaffUserStatus,
  staffUserSchema,
  updateStaffUser,
} from "@/lib/users";
import { toPlain } from "@/lib/serialize";
import type { UserStatus } from "@/generated/prisma/client";

function formError(error: unknown): Error {
  if (error instanceof ZodError) {
    return new Error(error.issues[0]?.message ?? "Dados inválidos");
  }
  if (error instanceof Error) return error;
  return new Error("Não foi possível salvar");
}

function parseStaffForm(formData: FormData) {
  return staffUserSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    roleCode: formData.get("roleCode"),
    unitId: formData.get("unitId"),
    status: formData.get("status") || "ACTIVE",
  });
}

function revalidateUsers() {
  revalidatePath("/usuarios");
  revalidatePath("/implantacao");
}

export async function createStaffUserAction(formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const data = parseStaffForm(formData);
    const result = await createStaffUser({
      clinicId: session.clinicId,
      organizationId: session.organizationId,
      actorId: session.user.id,
      data,
    });
    revalidateUsers();
    return {
      ok: true as const,
      user: toPlain(result.user),
      senhaProvisoria: result.senhaProvisoria,
    };
  } catch (error) {
    throw formError(error);
  }
}

export async function updateStaffUserAction(id: string, formData: FormData) {
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const data = parseStaffForm(formData);
    const user = await updateStaffUser({
      clinicId: session.clinicId,
      organizationId: session.organizationId,
      actorId: session.user.id,
      id,
      data,
    });
    revalidateUsers();
    return { ok: true as const, user: toPlain(user) };
  } catch (error) {
    throw formError(error);
  }
}

export async function setStaffUserStatusAction(id: string, status: UserStatus) {
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const user = await setStaffUserStatus({
      clinicId: session.clinicId,
      organizationId: session.organizationId,
      actorId: session.user.id,
      id,
      status,
    });
    revalidateUsers();
    return { ok: true as const, user: toPlain(user) };
  } catch (error) {
    throw formError(error);
  }
}

export async function resetStaffUserPasswordAction(id: string) {
  try {
    const session = await requirePermission(PERMISSIONS.USERS_MANAGE);
    const result = await resetStaffUserPassword({
      clinicId: session.clinicId,
      actorId: session.user.id,
      id,
    });
    revalidateUsers();
    return { ok: true as const, ...result };
  } catch (error) {
    throw formError(error);
  }
}
