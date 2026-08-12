import { prisma } from "@/lib/db";
import { organizacaoAtual } from "@/lib/tenant";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  STAFF_ROLE_DEFS,
} from "@/lib/auth/permissions";

/** Garante permissões, perfis de sistema e vínculos role↔permissão da clínica. */
export async function ensureSystemRoles(clinicId: string) {
  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: PERMISSION_LABELS[code] ?? code },
      update: { name: PERMISSION_LABELS[code] ?? code },
    });
  }

  const permissions = await prisma.permission.findMany({
    select: { id: true, code: true },
  });
  const byCode = Object.fromEntries(permissions.map((p) => [p.code, p.id]));
  const organizationId = organizacaoAtual();

  for (const def of STAFF_ROLE_DEFS) {
    let role = await prisma.role.findFirst({
      where: { clinicId, code: def.code },
      select: { id: true },
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId,
          clinicId,
          code: def.code,
          name: def.name,
          isSystem: true,
        },
        select: { id: true },
      });
    }

    const rows = (ROLE_PERMISSIONS[def.code] ?? [])
      .map((code) => byCode[code])
      .filter((permissionId): permissionId is string => Boolean(permissionId))
      .map((permissionId) => ({ roleId: role.id, permissionId }));

    if (rows.length > 0) {
      await prisma.rolePermission.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
  }
}

/** Garante permissões novas dos perfis de sistema (ex.: vale-presente na recepção). */
export async function ensureSystemRolePermissions(clinicId: string) {
  await ensureSystemRoles(clinicId);
}
