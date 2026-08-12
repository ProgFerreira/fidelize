import type { NextAuthConfig } from "next-auth";
import type { PermissionCode } from "@/lib/auth/permissions";

/**
 * Config edge-safe compartilhada com o proxy (sem Prisma / sem dotenv).
 * Não passe `secret: undefined` — o Auth.js lê AUTH_SECRET do ambiente.
 */
export const authConfig = {
  trustHost: true,
  ...(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    ? {
        secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      }
    : {}),
  session: {
    strategy: "jwt" as const,
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.organizationId = user.organizationId;
        token.organizationSlug = user.organizationSlug;
        token.clinicId = user.clinicId;
        token.unitId = user.unitId;
        token.roleCode = user.roleCode;
        token.permissions = user.permissions;
        token.mfaEnabled = user.mfaEnabled;
        token.ehAdminPlataforma = user.ehAdminPlataforma;
        token.affiliateId = user.affiliateId ?? null;
        token.suporteAcessoId = user.suporteAcessoId ?? null;
        token.suporteMotivo = user.suporteMotivo ?? null;
        token.suporteOrganizacaoNome = user.suporteOrganizacaoNome ?? null;
      }

      if (trigger === "update" && session) {
        const patch = session as {
          clinicId?: string | null;
          unitId?: string | null;
          suporteAcessoId?: string | null;
          organizationId?: string | null;
          organizationSlug?: string | null;
          suporteMotivo?: string | null;
          suporteOrganizacaoNome?: string | null;
        };

        if ("clinicId" in patch) {
          token.clinicId = patch.clinicId ?? null;
        }
        if ("unitId" in patch) {
          token.unitId = patch.unitId ?? null;
        }

        if (token.ehAdminPlataforma && "suporteAcessoId" in patch) {
          if (patch.suporteAcessoId) {
            token.suporteAcessoId = patch.suporteAcessoId;
            token.organizationId = patch.organizationId ?? null;
            token.organizationSlug = null;
            token.suporteMotivo = patch.suporteMotivo ?? null;
            token.suporteOrganizacaoNome =
              patch.suporteOrganizacaoNome ?? null;
          } else {
            token.suporteAcessoId = null;
            token.organizationId = null;
            token.organizationSlug = null;
            token.suporteMotivo = null;
            token.suporteOrganizacaoNome = null;
            token.clinicId = null;
            token.unitId = null;
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.organizationId =
          (token.organizationId as string | null | undefined) ?? null;
        session.user.organizationSlug =
          (token.organizationSlug as string | null | undefined) ?? null;
        session.user.clinicId =
          (token.clinicId as string | null | undefined) ?? null;
        session.user.unitId =
          (token.unitId as string | null | undefined) ?? null;
        session.user.roleCode = (token.roleCode as string) ?? "";
        session.user.permissions =
          (token.permissions as PermissionCode[] | undefined) ?? [];
        session.user.mfaEnabled = Boolean(token.mfaEnabled);
        session.user.ehAdminPlataforma = Boolean(token.ehAdminPlataforma);
        session.user.affiliateId =
          (token.affiliateId as string | null | undefined) ?? null;
        session.user.suporteAcessoId =
          (token.suporteAcessoId as string | null | undefined) ?? null;
        session.user.suporteMotivo =
          (token.suporteMotivo as string | null | undefined) ?? null;
        session.user.suporteOrganizacaoNome =
          (token.suporteOrganizacaoNome as string | null | undefined) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
