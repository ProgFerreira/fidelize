import { auth } from "@/lib/auth";
import type { PermissionCode } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { comOrganizacao, estabelecerOrganizacao } from "@/lib/tenant";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

export type StaffContext = Omit<Session, "user"> & {
  user: Session["user"] & { clinicId: string };
  clinicId: string;
  unitId: string | null;
  organizationId: string;
};

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Sessão staff com clínica de trabalho resolvida.
 * Nunca aceita clinicId/organizationId do client — só JWT + DB.
 */
export async function requireClinicContext(): Promise<StaffContext> {
  const session = await requireSession();

  if (!session.user.organizationId && !session.user.ehAdminPlataforma) {
    redirect("/login");
  }

  let clinicId = session.user.clinicId ?? null;

  if (!clinicId && session.user.organizationId) {
    const clinic = await comOrganizacao(
      { organizationId: session.user.organizationId },
      () =>
        prisma.clinic.findFirst({
          where: { active: true },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }),
    );
    clinicId = clinic?.id ?? null;
  }

  if (!clinicId || !session.user.organizationId) {
    redirect("/dashboard?erro=sem-clinica");
  }

  // Reafirma tenant após awaits (RSC pode perder enterWith entre hops).
  await estabelecerOrganizacao({
    organizationId: session.user.organizationId,
    suporte:
      session.user.ehAdminPlataforma && session.user.suporteAcessoId
        ? {
            userId: session.user.id,
            reason: session.user.suporteMotivo ?? "suporte",
          }
        : undefined,
  });

  const unitId = session.user.unitId ?? null;

  return {
    ...session,
    user: {
      ...session.user,
      clinicId,
      unitId,
    },
    clinicId,
    unitId,
    organizationId: session.user.organizationId,
  };
}

export async function requirePermission(
  permission: PermissionCode,
): Promise<StaffContext> {
  const ctx = await requireClinicContext();
  if (!ctx.user.permissions.includes(permission)) {
    redirect("/dashboard?erro=sem-permissao");
  }
  return ctx;
}

export function hasPermission(
  permissions: PermissionCode[] | undefined,
  permission: PermissionCode,
) {
  return Boolean(permissions?.includes(permission));
}

export async function requirePlatformAdmin() {
  const session = await requireSession();
  if (!session.user.ehAdminPlataforma || session.user.roleCode !== "PLATFORM_ADMIN") {
    redirect("/login");
  }
  if (session.user.suporteAcessoId) {
    redirect("/dashboard");
  }
  return session;
}

export async function requireAffiliateSession() {
  const session = await requireSession();
  if (session.user.roleCode !== "AFFILIATE" || !session.user.affiliateId) {
    redirect("/login");
  }
  return {
    ...session,
    affiliateId: session.user.affiliateId as string,
  };
}
