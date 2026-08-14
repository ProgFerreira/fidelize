import { LoginForm } from "@/components/auth/login-form";
import {
  LoginMobileBanner,
  LoginVisual,
} from "@/components/auth/login-visual";
import { auth } from "@/lib/auth";
import { Stethoscope } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { destinoAposLogin } from "@/lib/auth/post-login";
import {
  HEADER_ORG_SLUG,
  resolverHost,
} from "@/lib/organization-host";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ senha?: string }>;
}) {
  const { senha } = await searchParams;
  const session = await auth();
  if (session?.user) {
    redirect(destinoAposLogin(session.user));
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
      <LoginVisual />
      <LoginMobileBanner contexto={contexto} />

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
            senhaRedefinida={senha === "redefinida"}
          />
        </div>
      </main>
    </div>
  );
}
