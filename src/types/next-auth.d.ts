import type { DefaultSession } from "next-auth";
import type { PermissionCode } from "@/lib/auth/permissions";

declare module "next-auth" {
  interface User {
    organizationId: string | null;
    organizationSlug: string | null;
    clinicId?: string | null;
    unitId?: string | null;
    roleCode: string;
    permissions: PermissionCode[];
    mfaEnabled: boolean;
    ehAdminPlataforma: boolean;
    suporteAcessoId?: string | null;
    suporteMotivo?: string | null;
    suporteOrganizacaoNome?: string | null;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizationId: string | null;
      organizationSlug: string | null;
      clinicId?: string | null;
      unitId?: string | null;
      roleCode: string;
      permissions: PermissionCode[];
      mfaEnabled: boolean;
      ehAdminPlataforma: boolean;
      suporteAcessoId?: string | null;
      suporteMotivo?: string | null;
      suporteOrganizacaoNome?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string | null;
    organizationSlug?: string | null;
    clinicId?: string | null;
    unitId?: string | null;
    roleCode?: string;
    permissions?: PermissionCode[];
    mfaEnabled?: boolean;
    ehAdminPlataforma?: boolean;
    suporteAcessoId?: string | null;
    suporteMotivo?: string | null;
    suporteOrganizacaoNome?: string | null;
  }
}

export {};
