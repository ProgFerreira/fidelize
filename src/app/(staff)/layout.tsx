import { Shell } from "@/components/layout/shell";
import { menusAgrupados } from "@/lib/menus";
import { requireSession } from "@/lib/auth/guards";
import { ensureSystemRoles } from "@/lib/auth/sync-roles";
import { prisma } from "@/lib/db";
import { comOrganizacao } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const clinicId = session.user.clinicId;
  const organizationId = session.user.organizationId;

  let modules: { code: string }[] = [];
  if (clinicId && organizationId) {
    [modules] = await Promise.all([
      comOrganizacao({ organizationId }, () =>
        prisma.featureModule.findMany({
          where: { clinicId, enabled: true },
          select: { code: true },
        }),
      ),
      // Garante que permissões novas cheguem nos papéis de clínicas já
      // existentes sem depender de visitar uma página específica.
      comOrganizacao({ organizationId }, () => ensureSystemRoles(clinicId)),
    ]);
  }
  const enabled = modules.map((m) => m.code);

  return (
    <Shell
      grupos={menusAgrupados(
        session.user.permissions,
        enabled,
        session.user.roleCode,
      )}
      usuario={{
        nome: session.user.name ?? "",
        email: session.user.email ?? "",
        papel: session.user.roleCode,
      }}
      clinicId={session.user.clinicId}
      unitId={session.user.unitId}
      isSupport={Boolean(
        session.user.ehAdminPlataforma && session.user.suporteAcessoId,
      )}
      supportOrgName={session.user.suporteOrganizacaoNome}
    >
      {children}
    </Shell>
  );
}
