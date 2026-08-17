import { prisma } from "@/lib/db";
import { organizacaoAtual } from "@/lib/tenant";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  STAFF_ROLE_DEFS,
} from "@/lib/auth/permissions";

async function sincronizarPermissoesEPapeis(clinicId: string) {
  const codigos = Object.values(PERMISSIONS);
  const existentes = await prisma.permission.findMany({
    select: { id: true, code: true },
  });
  const idPorCodigo = new Map(existentes.map((p) => [p.code, p.id]));

  const faltando = codigos.filter((code) => !idPorCodigo.has(code));
  if (faltando.length > 0) {
    await prisma.permission.createMany({
      data: faltando.map((code) => ({ code, name: PERMISSION_LABELS[code] ?? code })),
      skipDuplicates: true,
    });
    const criadas = await prisma.permission.findMany({
      where: { code: { in: faltando } },
      select: { id: true, code: true },
    });
    for (const p of criadas) idPorCodigo.set(p.code, p.id);
  }

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
      .map((code) => idPorCodigo.get(code))
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

const SYNC_TTL_MS = 10 * 60 * 1000;
const sincronizadosEm = new Map<string, number>();

/**
 * Garante permissões, perfis de sistema e vínculos role↔permissão da clínica.
 *
 * Chamada a cada requisição no layout do staff (`src/app/(staff)/layout.tsx`)
 * para que uma permissão nova adicionada no código chegue automaticamente nos
 * papéis de clínicas já existentes, sem depender de alguém visitar uma página
 * específica. Por isso o resultado fica em cache em memória por clínica por
 * `SYNC_TTL_MS` — sem isso, cada navegação repetiria ~10 queries à toa.
 */
export async function ensureSystemRoles(clinicId: string) {
  const ultimaVez = sincronizadosEm.get(clinicId);
  if (ultimaVez && Date.now() - ultimaVez < SYNC_TTL_MS) return;

  await sincronizarPermissoesEPapeis(clinicId);
  sincronizadosEm.set(clinicId, Date.now());
}

/** Alias semântico, usado nos fluxos de recepção/onboarding. */
export async function ensureSystemRolePermissions(clinicId: string) {
  await ensureSystemRoles(clinicId);
}
