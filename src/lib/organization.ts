import { cache } from "react";
import { prisma } from "@/lib/db";
import { semOrganizacao } from "@/lib/tenant";

export {
  HEADER_ORG_SLUG,
  HEADER_REQUEST_ID,
  HEADER_CLINIC_HOST,
  SLUG_ORG_PLATAFORMA,
  SUBDOMINIO_PLATAFORMA,
  SUBDOMINIOS_RESERVADOS,
  resolverHost,
  type ResolucaoHost,
} from "@/lib/organization-host";

export type OrganizacaoResolvida = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  suspendedAt: Date | null;
  suspensionReason: string | null;
};

export const buscarOrganizacaoPorSlug = cache(
  async (slug: string): Promise<OrganizacaoResolvida | null> => {
    return semOrganizacao(() =>
      prisma.organization.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true,
          suspendedAt: true,
          suspensionReason: true,
        },
      }),
    );
  },
);

export function organizacaoOperante(
  org: Pick<OrganizacaoResolvida, "active" | "suspendedAt">,
): boolean {
  return org.active && !org.suspendedAt;
}

export async function buscarClinicaPorHost(host: string) {
  const semPorta = host.split(":")[0]!.toLowerCase();
  return semOrganizacao(async () => {
    const byDomain = await prisma.clinic.findFirst({
      where: { customDomain: semPorta, active: true },
      select: {
        id: true,
        organizationId: true,
        slug: true,
        name: true,
        customDomain: true,
      },
    });
    if (byDomain) return byDomain;

    const partes = semPorta.split(".");
    const ehLocalhost = partes[partes.length - 1] === "localhost";
    const temSubdominio = ehLocalhost ? partes.length >= 2 : partes.length >= 3;
    if (!temSubdominio) return null;
    const slug = partes[0]!;
    if (slug === "admin" || slug.startsWith("_")) return null;

    return prisma.clinic.findFirst({
      where: { slug, active: true },
      select: {
        id: true,
        organizationId: true,
        slug: true,
        name: true,
        customDomain: true,
      },
    });
  });
}
