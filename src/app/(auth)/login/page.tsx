import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";
import { Sparkles, Stethoscope } from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  HEADER_ORG_SLUG,
  resolverHost,
} from "@/lib/organization-host";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(
      session.user.ehAdminPlataforma && !session.user.suporteAcessoId
        ? "/organizacoes"
        : "/dashboard",
    );
  }

  const h = await headers();
  const host = resolverHost(h.get("host"));
  const slugHeader = h.get(HEADER_ORG_SLUG);
  const organizationSlug =
    host.tipo === "organizacao" ? host.slug : slugHeader || null;

  const contexto =
    host.tipo === "plataforma"
      ? "Administração da plataforma"
      : organizationSlug
        ? `Clube de Benefícios · ${organizationSlug}`
        : "Clube de Benefícios";

  return (
    <div className="login-page">
      <aside className="login-visual">
        <div className="login-visual__media">
          <Image
            src="/images/login-hero.jpg"
            alt="Ambiente premium de clínica"
            fill
            sizes="(min-width: 960px) 55vw, 1px"
          />
        </div>
        <div className="login-visual__overlay" />
        <div className="login-visual__content">
          <p className="login-visual__eyebrow">
            <Sparkles aria-hidden />
            Fidelize Premium
          </p>
          <h1 className="login-visual__title">
            Seu clube de benefícios, <span>com elegância</span>
          </h1>
          <p className="login-visual__desc">
            Cashback, pontos, cartão digital e campanhas em uma experiência
            feita para clínicas que valorizam cada paciente.
          </p>
          <div className="login-visual__stats">
            <div className="login-visual__stat">
              <strong>Cashback</strong>
              <span>Retorno real nas vendas</span>
            </div>
            <div className="login-visual__stat">
              <strong>Pontos</strong>
              <span>Engajamento contínuo</span>
            </div>
            <div className="login-visual__stat">
              <strong>Cartão</strong>
              <span>Identidade digital</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="login-mobile-banner">
        <div className="login-mobile-banner__media">
          <Image
            src="/images/login-hero.jpg"
            alt=""
            fill
            sizes="100vw"
          />
        </div>
        <div className="login-mobile-banner__overlay" />
        <div className="login-mobile-banner__content">
          <h2>Fidelize</h2>
          <p>{contexto}</p>
        </div>
      </div>

      <main className="login-panel">
        <div className="login-panel__inner">
          <div className="login-panel__brand">
            <div className="login-panel__brand-icon">
              <Stethoscope aria-hidden />
            </div>
            <div className="login-panel__brand-text">
              <span className="login-panel__brand-name">Fidelize</span>
              <span className="login-panel__brand-sub">{contexto}</span>
            </div>
          </div>

          <h2 className="login-panel__heading">Bem-vindo de volta</h2>
          <p className="login-panel__lede">
            Entre com suas credenciais para acessar o painel.
          </p>

          <LoginForm
            organizationSlug={organizationSlug}
            hostTipo={host.tipo}
          />
        </div>
      </main>
    </div>
  );
}
