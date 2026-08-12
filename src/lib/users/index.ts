import { randomBytes } from "crypto";
import { z } from "zod";
import type { UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import {
  STAFF_ROLE_CODES,
  type StaffRoleCode,
} from "@/lib/auth/permissions";
import { ensureSystemRoles } from "@/lib/auth/sync-roles";
import { onlyDigits } from "@/lib/patients/cpf";
import { organizacaoAtual } from "@/lib/tenant";
import type { StaffUserDTO, StaffRoleOption, StaffUnitOption } from "@/lib/users/types";

export type { StaffUserDTO, StaffRoleOption, StaffUnitOption, StaffUserStatus } from "@/lib/users/types";

function vazioParaNulo(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

export const staffUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nome obrigatório (mínimo 3 caracteres)")
    .max(120),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(180)
    .transform((v) => v.toLowerCase()),
  phone: z.preprocess((value) => {
    const nulo = vazioParaNulo(value);
    if (nulo == null) return null;
    return onlyDigits(String(nulo));
  }, z
    .string()
    .refine(
      (v) => v.length >= 10 && v.length <= 13,
      "Telefone inválido (DDD + número)",
    )
    .nullable()
    .optional()),
  roleCode: z.enum(STAFF_ROLE_CODES),
  unitId: z.preprocess(vazioParaNulo, z.string().min(1).nullable().optional()),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).default("ACTIVE"),
});

export type StaffUserInput = z.infer<typeof staffUserSchema>;

const userInclude = {
  role: { select: { id: true, code: true, name: true } },
  unit: { select: { id: true, name: true } },
} as const;

function toDTO(row: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  roleId: string;
  unitId: string | null;
  lastLoginAt: Date | null;
  mfaEnabled: boolean;
  role: { id: string; code: string; name: string };
  unit: { id: string; name: string } | null;
}): StaffUserDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    roleId: row.roleId,
    roleCode: row.role.code,
    roleName: row.role.name,
    unitId: row.unitId,
    unitName: row.unit?.name ?? null,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    mfaEnabled: row.mfaEnabled,
  };
}

export function generateTemporaryPassword() {
  return `Tmp@${randomBytes(5).toString("hex")}A1`;
}

async function staffRoleOfClinic(clinicId: string, roleCode: StaffRoleCode) {
  await ensureSystemRoles(clinicId);
  const role = await prisma.role.findFirst({
    where: { clinicId, code: roleCode, isSystem: true },
  });
  if (!role) throw new Error("Perfil não encontrado nesta clínica");
  return role;
}

async function assertUnit(clinicId: string, unitId: string | null | undefined) {
  if (!unitId) return null;
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, clinicId, active: true },
    select: { id: true },
  });
  if (!unit) throw new Error("Unidade inválida");
  return unit.id;
}

async function assertEmailLivre(params: {
  organizationId: string | null;
  email: string;
  excludeId?: string;
}) {
  const existing = await prisma.user.findFirst({
    where: {
      email: params.email,
      organizationId: params.organizationId,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new Error("Já existe um usuário com este e-mail");
}

async function countActiveAdmins(clinicId: string, excludeId?: string) {
  return prisma.user.count({
    where: {
      clinicId,
      status: "ACTIVE",
      role: { code: "ADMIN" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

async function assertNaoRemoveUltimoAdmin(params: {
  clinicId: string;
  userId: string;
  currentRoleCode: string;
  nextRoleCode: string;
  nextStatus: UserStatus;
}) {
  const continuaAdminAtivo =
    params.nextRoleCode === "ADMIN" && params.nextStatus === "ACTIVE";
  if (continuaAdminAtivo) return;
  if (params.currentRoleCode !== "ADMIN") return;

  const outros = await countActiveAdmins(params.clinicId, params.userId);
  if (outros === 0) {
    throw new Error("Não é possível remover o último administrador ativo");
  }
}

export async function listStaffRoles(clinicId: string): Promise<StaffRoleOption[]> {
  await ensureSystemRoles(clinicId);
  const roles = await prisma.role.findMany({
    where: { clinicId, code: { in: [...STAFF_ROLE_CODES] } },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  return roles
    .filter((r): r is { id: string; code: StaffRoleCode; name: string } =>
      (STAFF_ROLE_CODES as readonly string[]).includes(r.code),
    )
    .sort(
      (a, b) =>
        STAFF_ROLE_CODES.indexOf(a.code) - STAFF_ROLE_CODES.indexOf(b.code),
    );
}

export async function listStaffUnits(
  clinicId: string,
): Promise<StaffUnitOption[]> {
  return prisma.unit.findMany({
    where: { clinicId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listStaffUsers(params: {
  clinicId: string;
}): Promise<StaffUserDTO[]> {
  const rows = await prisma.user.findMany({
    where: { clinicId: params.clinicId },
    include: userInclude,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return rows.map(toDTO);
}

export async function createStaffUser(params: {
  clinicId: string;
  organizationId: string;
  actorId: string;
  data: StaffUserInput;
}) {
  const data = staffUserSchema.parse(params.data);
  const organizationId = params.organizationId || organizacaoAtual();
  if (!organizationId) throw new Error("Organização não encontrada");

  if (data.status === "ACTIVE") {
    const { assertWithinPlanLimits } = await import("@/lib/billing/enforce");
    await assertWithinPlanLimits({
      organizationId,
      kind: "users",
    });
  }

  await assertEmailLivre({ organizationId, email: data.email });
  const role = await staffRoleOfClinic(params.clinicId, data.roleCode);
  const unitId = await assertUnit(params.clinicId, data.unitId);
  const senhaProvisoria = generateTemporaryPassword();
  const passwordHash = await hashPassword(senhaProvisoria);

  const row = await prisma.user.create({
    data: {
      organizationId,
      clinicId: params.clinicId,
      unitId,
      roleId: role.id,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      passwordHash,
      status: data.status,
    },
    include: userInclude,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "PERMISSION_CHANGE",
    entityType: "User",
    entityId: row.id,
    afterData: {
      name: row.name,
      email: row.email,
      roleCode: row.role.code,
      status: row.status,
    },
    metadata: { kind: "user.create" },
  });

  return { user: toDTO(row), senhaProvisoria };
}

export async function updateStaffUser(params: {
  clinicId: string;
  organizationId: string;
  actorId: string;
  id: string;
  data: StaffUserInput;
}) {
  const data = staffUserSchema.parse(params.data);
  const existing = await prisma.user.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
    include: userInclude,
  });
  if (!existing) throw new Error("Usuário não encontrado");

  if (existing.id === params.actorId && data.status !== "ACTIVE") {
    throw new Error("Você não pode inativar ou bloquear o próprio acesso");
  }

  await assertNaoRemoveUltimoAdmin({
    clinicId: params.clinicId,
    userId: existing.id,
    currentRoleCode: existing.role.code,
    nextRoleCode: data.roleCode,
    nextStatus: data.status,
  });

  if (data.status === "ACTIVE" && existing.status !== "ACTIVE") {
    const { assertWithinPlanLimits } = await import("@/lib/billing/enforce");
    await assertWithinPlanLimits({
      organizationId: params.organizationId,
      kind: "users",
    });
  }

  await assertEmailLivre({
    organizationId: params.organizationId,
    email: data.email,
    excludeId: existing.id,
  });
  const role = await staffRoleOfClinic(params.clinicId, data.roleCode);
  const unitId = await assertUnit(params.clinicId, data.unitId);

  const row = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      roleId: role.id,
      unitId,
      status: data.status,
    },
    include: userInclude,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "PERMISSION_CHANGE",
    entityType: "User",
    entityId: row.id,
    beforeData: {
      name: existing.name,
      email: existing.email,
      roleCode: existing.role.code,
      status: existing.status,
    },
    afterData: {
      name: row.name,
      email: row.email,
      roleCode: row.role.code,
      status: row.status,
    },
    metadata: { kind: "user.update" },
  });

  return toDTO(row);
}

export async function setStaffUserStatus(params: {
  clinicId: string;
  organizationId: string;
  actorId: string;
  id: string;
  status: UserStatus;
}) {
  const status = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).parse(params.status);
  const existing = await prisma.user.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
    include: userInclude,
  });
  if (!existing) throw new Error("Usuário não encontrado");

  if (existing.id === params.actorId && status !== "ACTIVE") {
    throw new Error("Você não pode inativar ou bloquear o próprio acesso");
  }

  await assertNaoRemoveUltimoAdmin({
    clinicId: params.clinicId,
    userId: existing.id,
    currentRoleCode: existing.role.code,
    nextRoleCode: existing.role.code,
    nextStatus: status,
  });

  if (status === "ACTIVE" && existing.status !== "ACTIVE") {
    const { assertWithinPlanLimits } = await import("@/lib/billing/enforce");
    await assertWithinPlanLimits({
      organizationId: params.organizationId,
      kind: "users",
    });
  }

  const row = await prisma.user.update({
    where: { id: existing.id },
    data: { status },
    include: userInclude,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "PERMISSION_CHANGE",
    entityType: "User",
    entityId: row.id,
    beforeData: { status: existing.status },
    afterData: { status: row.status },
    metadata: { kind: "user.status" },
  });

  return toDTO(row);
}

export async function resetStaffUserPassword(params: {
  clinicId: string;
  actorId: string;
  id: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
    select: { id: true, email: true },
  });
  if (!existing) throw new Error("Usuário não encontrado");

  const senhaProvisoria = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      passwordHash: await hashPassword(senhaProvisoria),
      resetToken: null,
      resetExpiresAt: null,
    },
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "PERMISSION_CHANGE",
    entityType: "User",
    entityId: existing.id,
    metadata: { kind: "user.password_reset" },
  });

  return { email: existing.email, senhaProvisoria };
}
