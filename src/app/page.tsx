import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { destinoAposLogin } from "@/lib/auth/post-login";
import { PublicLanding } from "@/components/public/landing";
import {
  buscarClinicaPorHost,
  buscarOrganizacaoPorSlug,
  resolverHost,
} from "@/lib/organization";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(destinoAposLogin(session.user));

  const { ref } = await searchParams;
  if (ref) {
    redirect(`/indicacao?ref=${encodeURIComponent(ref)}`);
  }

  const host = (await headers()).get("host");
  const clinic = host ? await buscarClinicaPorHost(host) : null;
  const resolved = resolverHost(host);
  const org =
    resolved.tipo === "organizacao"
      ? await buscarOrganizacaoPorSlug(resolved.slug)
      : null;
  const tenantName = clinic?.name || org?.name || null;

  return (
    <PublicLanding
      eyebrow={tenantName ?? "Clube de Benefícios"}
      titulo={
        tenantName
          ? `Bem-vindo ao clube ${tenantName}`
          : "Fidelize o relacionamento com seus pacientes"
      }
      descricao={
        tenantName
          ? "Acesse o painel da clínica ou o portal do paciente para ver saldo, prêmios e benefícios."
          : "Cashback, pontos, cartão digital e campanhas em um único clube de benefícios."
      }
      ctaPrimario={{ href: "/login", label: "Entrar no painel" }}
      ctaSecundario={{ href: "/paciente", label: "Sou paciente" }}
    />
  );
}
