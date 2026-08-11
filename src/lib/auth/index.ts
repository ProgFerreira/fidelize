import "@/lib/load-env";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit";
import { verifySync } from "otplib";
import type { PermissionCode } from "@/lib/auth/permissions";
import { authConfig } from "@/lib/auth/config";
import {
  comOrganizacao,
  estabelecerOrganizacao,
  semOrganizacao,
} from "@/lib/tenant";
import {
  buscarOrganizacaoPorSlug,
  organizacaoOperante,
} from "@/lib/organization";

function authSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

const nextAuth = NextAuth({
  ...authConfig,
  ...(authSecret() ? { secret: authSecret() } : {}),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        mfaCode: { label: "MFA", type: "text" },
        organizationSlug: { label: "Org", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const mfaCode = String(credentials?.mfaCode ?? "").trim();
        const organizationSlug = String(credentials?.organizationSlug ?? "")
          .trim()
          .toLowerCase();

        if (!email || !password) {
          return null;
        }

        const org = organizationSlug
          ? await buscarOrganizacaoPorSlug(organizationSlug)
          : null;

        if (organizationSlug) {
          if (!org) return null;
          if (!organizacaoOperante(org)) {
            throw new Error("ORGANIZATION_SUSPENDED");
          }
        }

        const user = await semOrganizacao(() =>
          prisma.user.findFirst({
            where: {
              email,
              organizationId: org ? org.id : null,
            },
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
              organization: true,
            },
          }),
        );

        if (!user || user.status !== "ACTIVE") {
          await semOrganizacao(() =>
            writeAuditLog({
              action: "LOGIN_FAILED",
              metadata: { email, reason: "user_not_found_or_inactive" },
            }),
          );
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const log = async () =>
            writeAuditLog({
              clinicId: user.clinicId,
              userId: user.id,
              action: "LOGIN_FAILED",
              metadata: { email, reason: "invalid_password" },
            });
          if (user.organizationId) {
            await comOrganizacao({ organizationId: user.organizationId }, log);
          } else {
            await semOrganizacao(log);
          }
          return null;
        }

        const requiresMfa =
          user.mfaEnabled &&
          (user.role.code === "ADMIN" || user.role.code === "FINANCE");

        if (requiresMfa) {
          if (!user.mfaSecret || !mfaCode) {
            throw new Error("MFA_REQUIRED");
          }
          const ok = verifySync({ token: mfaCode, secret: user.mfaSecret })
            .valid;
          if (!ok) {
            const log = async () =>
              writeAuditLog({
                clinicId: user.clinicId,
                userId: user.id,
                action: "LOGIN_FAILED",
                metadata: { email, reason: "invalid_mfa" },
              });
            if (user.organizationId) {
              await comOrganizacao(
                { organizationId: user.organizationId },
                log,
              );
            } else {
              await semOrganizacao(log);
            }
            return null;
          }
        }

        const finish = async () => {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          await writeAuditLog({
            clinicId: user.clinicId,
            unitId: user.unitId,
            userId: user.id,
            action: "LOGIN",
            entityType: "User",
            entityId: user.id,
          });
        };

        if (user.organizationId) {
          await comOrganizacao({ organizationId: user.organizationId }, finish);
        } else {
          await semOrganizacao(finish);
        }

        const permissions = user.role.permissions.map(
          (rp) => rp.permission.code as PermissionCode,
        );

        const ehAdminPlataforma = user.organizationId === null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          organizationId: user.organizationId,
          organizationSlug: user.organization?.slug ?? null,
          clinicId: user.clinicId,
          unitId: user.unitId,
          roleCode: user.role.code,
          permissions,
          mfaEnabled: user.mfaEnabled,
          ehAdminPlataforma,
        };
      },
    }),
  ],
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * Wrapper que estabelece o contexto de tenant a partir da sessão JWT.
 * Usar este `auth()` em pages/actions — não o nextAuth.auth cru.
 */
export async function auth() {
  const sessao = await nextAuth.auth();
  if (sessao?.user?.organizationId) {
    await estabelecerOrganizacao({
      organizationId: sessao.user.organizationId,
      suporte:
        sessao.user.ehAdminPlataforma && sessao.user.suporteAcessoId
          ? {
              userId: sessao.user.id,
              reason: sessao.user.suporteMotivo ?? "suporte",
            }
          : undefined,
    });
  }
  return sessao;
}
