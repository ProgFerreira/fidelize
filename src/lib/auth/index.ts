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

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;

function extractIp(request: Request | undefined): string | null {
  const forwarded = request?.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || null;
}

/**
 * Bloqueia por IP após N falhas na janela — não grava audit log para o
 * bloqueio em si, só conta falhas reais (LOGIN_FAILED), então a janela
 * desliza normalmente sem se auto-estender enquanto o atacante insiste.
 */
async function checkLoginRateLimit(ip: string | null) {
  if (!ip) return;
  const since = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MS);
  const attempts = await semOrganizacao(() =>
    prisma.auditLog.count({
      where: {
        action: "LOGIN_FAILED",
        ipAddress: ip,
        createdAt: { gte: since },
      },
    }),
  );
  if (attempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new Error("TOO_MANY_ATTEMPTS");
  }
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
      async authorize(credentials, request) {
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

        const ip = extractIp(request);
        await checkLoginRateLimit(ip);

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
              ipAddress: ip,
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
              ipAddress: ip,
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

        const ehAdminPlataforma =
          user.organizationId === null && user.role.code === "PLATFORM_ADMIN";

        let affiliateId: string | null = null;
        if (user.role.code === "AFFILIATE") {
          const profile = await semOrganizacao(() =>
            prisma.affiliate.findUnique({
              where: { userId: user.id },
              select: { id: true },
            }),
          );
          affiliateId = profile?.id ?? null;
        }

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
          affiliateId,
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
    // estabelecerOrganizacao usa enterWith + Map por request-id.
    // Em seguida reforçamos com comOrganizacao no-op para garantir ALS.run
    // no mesmo tick em que a page/layout continua (Hostinger/RSC).
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
