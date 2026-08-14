import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { semOrganizacao } from "@/lib/tenant";
import { PublicLanding } from "@/components/public/landing";
import {
  buscarClinicaPorHost,
  buscarOrganizacaoPorSlug,
  resolverHost,
} from "@/lib/organization";

export default async function IndicacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const code = (ref ?? "").trim().slice(0, 32);
  const affiliate = code
    ? await semOrganizacao(() =>
        prisma.affiliate.findUnique({
          where: { code },
          select: { name: true, status: true, code: true },
        }),
      )
    : null;

  const host = (await headers()).get("host");
  const clinic = host ? await buscarClinicaPorHost(host) : null;
  const resolved = resolverHost(host);
  const org =
    resolved.tipo === "organizacao"
      ? await buscarOrganizacaoPorSlug(resolved.slug)
      : null;
  const tenantName = clinic?.name || org?.name || "Fidelize";
  const ativo = affiliate?.status === "ACTIVE";

  return (
    <PublicLanding
      eyebrow={tenantName}
      titulo={
        ativo
          ? `${affiliate.name} convidou você`
          : "Você foi convidado para o clube"
      }
      descricao={
        ativo
          ? `Crie sua conta ou fale com a clínica para entrar no clube de benefícios ${tenantName}.`
          : "Use o link da indicação para conhecer o clube de benefícios e falar com a clínica."
      }
      refCode={affiliate?.code ?? (code || null)}
      ctaPrimario={{ href: "/login", label: "Quero conhecer o painel" }}
      ctaSecundario={{ href: "/paciente", label: "Já sou paciente" }}
    />
  );
}
