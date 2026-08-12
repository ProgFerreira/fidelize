import { Shell } from "@/components/layout/shell";
import { menusAgrupados } from "@/lib/menus";
import { requireSession } from "@/lib/auth/guards";
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
  const modules =
    clinicId && organizationId
      ? await comOrganizacao({ organizationId }, () =>
          prisma.featureModule.findMany({
            where: { clinicId, enabled: true },
            select: { code: true },
          }),
        )
      : [];
  const enabled = modules.map((m) => m.code);

  return (
    <Shell
      grupos={menusAgrupados(session.user.permissions, enabled)}
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
