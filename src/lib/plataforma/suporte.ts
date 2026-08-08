import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { SLUG_ORG_PLATAFORMA } from "@/lib/organization-host";

export async function listarOrganizacoes() {
  return semOrganizacao(() =>
    prisma.organization.findMany({
      where: {
        deletedAt: null,
        slug: { not: SLUG_ORG_PLATAFORMA },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        tradeName: true,
        plan: true,
        active: true,
        suspendedAt: true,
        createdAt: true,
        _count: { select: { clinics: true, users: true } },
      },
    }),
  );
}

export async function iniciarAcessoSuporte(input: {
  organizationId: string;
  userId: string;
  reason: string;
  ip?: string | null;
}) {
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new Error("Motivo deve ter entre 10 e 500 caracteres");
  }

  const org = await semOrganizacao(() =>
    prisma.organization.findUnique({
      where: { id: input.organizationId },
    }),
  );
  if (!org || org.slug === SLUG_ORG_PLATAFORMA) {
    throw new Error("Organização inválida");
  }

  await semOrganizacao(async () => {
    await prisma.platformAccess.updateMany({
      where: { userId: input.userId, endedAt: null },
      data: { endedAt: new Date() },
    });
  });

  const acesso = await semOrganizacao(() =>
    prisma.platformAccess.create({
      data: {
        organizationId: org.id,
        userId: input.userId,
        reason,
        ip: input.ip ?? null,
      },
    }),
  );

  await comOrganizacao({ organizationId: org.id }, async () => {
    await writeAuditLog({
      userId: input.userId,
      action: "OTHER",
      entityType: "PlatformAccess",
      entityId: acesso.id,
      metadata: { reason, type: "support_start" },
    });
  });

  return {
    acessoId: acesso.id,
    organizationId: org.id,
    organizationSlug: org.slug,
    organizationName: org.name,
    reason,
  };
}

export async function encerrarAcessoSuporte(input: {
  userId: string;
  acessoId?: string | null;
}) {
  const aberto = await semOrganizacao(() =>
    prisma.platformAccess.findFirst({
      where: {
        userId: input.userId,
        endedAt: null,
        ...(input.acessoId ? { id: input.acessoId } : {}),
      },
      include: { organization: true },
    }),
  );

  if (!aberto) return null;

  await semOrganizacao(() =>
    prisma.platformAccess.update({
      where: { id: aberto.id },
      data: { endedAt: new Date() },
    }),
  );

  await comOrganizacao({ organizationId: aberto.organizationId }, async () => {
    await writeAuditLog({
      userId: input.userId,
      action: "OTHER",
      entityType: "PlatformAccess",
      entityId: aberto.id,
      metadata: { type: "support_end" },
    });
  });

  return aberto;
}
