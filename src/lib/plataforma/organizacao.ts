import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { SLUG_ORG_PLATAFORMA } from "@/lib/organization-host";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";
import { ensureModulesForClinic } from "@/lib/modules";

function gerarSenhaProvisoria() {
  return `Tmp@${Math.random().toString(36).slice(2, 10)}A1`;
}

export async function criarOrganizacao(entrada: {
  slug: string;
  name: string;
  tradeName?: string;
  document?: string;
  contactEmail?: string;
  contactPhone?: string;
  plan?: string;
  adminName?: string;
  adminEmail: string;
}) {
  const slug = entrada.slug.trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])?$/.test(slug)) {
    throw new Error("Slug inválido");
  }
  if (slug.startsWith("_") || slug === "admin") {
    throw new Error("Slug reservado");
  }

  const existente = await semOrganizacao(() =>
    prisma.organization.findUnique({ where: { slug } }),
  );
  if (existente) throw new Error("Slug já em uso");

  const org = await semOrganizacao(() =>
    prisma.organization.create({
      data: {
        slug,
        name: entrada.name.trim(),
        tradeName: entrada.tradeName?.trim() || null,
        document: entrada.document?.trim() || null,
        contactEmail: entrada.contactEmail?.trim() || null,
        contactPhone: entrada.contactPhone?.trim() || null,
        plan: entrada.plan ?? "trial",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    }),
  );

  const senhaProvisoria = gerarSenhaProvisoria();
  const passwordHash = await hashPassword(senhaProvisoria);

  await comOrganizacao({ organizationId: org.id }, async () => {
    for (const code of Object.values(PERMISSIONS)) {
      await prisma.permission.upsert({
        where: { code },
        create: {
          code,
          name: PERMISSION_LABELS[code] ?? code,
        },
        update: {},
      });
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: entrada.name.trim(),
        tradeName: entrada.tradeName?.trim() || null,
        document: entrada.document?.trim() || null,
        email: entrada.contactEmail?.trim() || null,
        phone: entrada.contactPhone?.trim() || null,
        slug,
        active: true,
      },
    });

    const adminPerms = ROLE_PERMISSIONS.ADMIN;
    const role = await prisma.role.create({
      data: {
        clinicId: clinic.id,
        code: "ADMIN",
        name: "Administrador",
        isSystem: true,
      },
    });

    for (const code of adminPerms) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (!perm) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }

    await prisma.user.create({
      data: {
        clinicId: clinic.id,
        roleId: role.id,
        name: entrada.adminName?.trim() || "Administrador",
        email: entrada.adminEmail.trim().toLowerCase(),
        passwordHash,
        status: "ACTIVE",
      },
    });

    await ensureModulesForClinic(clinic.id);
  });

  return {
    organizationId: org.id,
    slug: org.slug,
    adminEmail: entrada.adminEmail.trim().toLowerCase(),
    senhaProvisoria,
  };
}

export async function garantirOrgPlataforma() {
  return semOrganizacao(() =>
    prisma.organization.upsert({
      where: { slug: SLUG_ORG_PLATAFORMA },
      create: {
        slug: SLUG_ORG_PLATAFORMA,
        name: "Plataforma Fidelize",
        plan: "enterprise",
        active: true,
      },
      update: {},
    }),
  );
}
