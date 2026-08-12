"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ehAdminPlataforma } from "@/lib/plataforma";
import { criarOrganizacao } from "@/lib/plataforma/organizacao";
import {
  encerrarAcessoSuporte,
  iniciarAcessoSuporte,
  listarOrganizacoes,
} from "@/lib/plataforma/suporte";

export async function listOrganizationsAction() {
  const session = await auth();
  if (!ehAdminPlataforma(session)) throw new Error("Forbidden");
  return listarOrganizacoes();
}

export async function createOrganizationAction(formData: FormData) {
  const session = await auth();
  if (!ehAdminPlataforma(session)) throw new Error("Forbidden");

  return criarOrganizacao({
    slug: String(formData.get("slug") || ""),
    name: String(formData.get("name") || ""),
    tradeName: String(formData.get("tradeName") || "") || undefined,
    document: String(formData.get("document") || "") || undefined,
    contactEmail: String(formData.get("contactEmail") || "") || undefined,
    contactPhone: String(formData.get("contactPhone") || "") || undefined,
    adminName: String(formData.get("adminName") || "") || undefined,
    adminEmail: String(formData.get("adminEmail") || ""),
    affiliateCode: String(formData.get("affiliateCode") || "") || undefined,
    affiliateActorId: session?.user?.id,
  });
}

export async function startSupportAction(formData: FormData) {
  const session = await auth();
  if (!ehAdminPlataforma(session) || !session?.user) {
    throw new Error("Forbidden");
  }

  return iniciarAcessoSuporte({
    organizationId: String(formData.get("organizationId") || ""),
    userId: session.user.id,
    reason: String(formData.get("reason") || ""),
  });
}

export async function endSupportAction() {
  const session = await auth();
  if (!ehAdminPlataforma(session) || !session?.user) {
    throw new Error("Forbidden");
  }
  return encerrarAcessoSuporte({
    userId: session.user.id,
    acessoId: session.user.suporteAcessoId,
  });
}

export async function switchClinicAction(clinicId: string, unitId?: string | null) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }

  // Never trust client organizationId — validate clinic belongs to session org
  const clinic = await prisma.clinic.findFirst({
    where: {
      id: clinicId,
      organizationId: session.user.organizationId,
      active: true,
    },
    select: { id: true, organizationId: true },
  });

  if (!clinic) {
    throw new Error("Clínica inválida para esta organização");
  }

  let unit: { id: string } | null = null;
  if (unitId) {
    unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        clinicId: clinic.id,
        organizationId: session.user.organizationId,
        active: true,
      },
      select: { id: true },
    });
    if (!unit) throw new Error("Unidade inválida");
  }

  // Persist preferred workspace on user row (server-side only)
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      clinicId: clinic.id,
      unitId: unit?.id ?? null,
    },
  });

  return {
    clinicId: clinic.id,
    unitId: unit?.id ?? null,
  };
}

export async function listClinicsForSessionAction() {
  const session = await auth();
  if (!session?.user?.organizationId) return [];

  return prisma.clinic.findMany({
    where: {
      organizationId: session.user.organizationId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      units: {
        where: { active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}
