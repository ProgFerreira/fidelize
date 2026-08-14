import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  LoginMobileBanner,
  LoginVisual,
} from "@/components/auth/login-visual";
import { Stethoscope } from "lucide-react";
import { headers } from "next/headers";
import { HEADER_ORG_SLUG, resolverHost } from "@/lib/organization-host";

export default async function RecuperarSenhaPage() {
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

          <h2 className="login-panel__heading">Recuperar senha</h2>
          <p className="login-panel__lede">
            Informe o e-mail da sua conta. Se estiver cadastrado, você receberá
            um link para redefinir a senha.
          </p>

          <ForgotPasswordForm
            organizationSlug={organizationSlug}
            hostTipo={host.tipo}
          />
        </div>
      </main>
    </div>
  );
}
