import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  LoginMobileBanner,
  LoginVisual,
} from "@/components/auth/login-visual";
import { isPasswordResetTokenValid } from "@/lib/auth/password-reset";
import { Stethoscope } from "lucide-react";
import { headers } from "next/headers";
import { HEADER_ORG_SLUG, resolverHost } from "@/lib/organization-host";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valido = token ? await isPasswordResetTokenValid(token) : false;

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

          <h2 className="login-panel__heading">Redefinir senha</h2>
          {valido ? (
            <>
              <p className="login-panel__lede">
                Escolha uma nova senha para acessar o painel.
              </p>
              <ResetPasswordForm token={token!} />
            </>
          ) : (
            <>
              <p className="login-panel__lede">
                Este link é inválido ou expirou. Solicite um novo para
                redefinir a senha.
              </p>
              <p className="login-form__row">
                <Link href="/recuperar-senha" className="login-form__link">
                  Pedir novo link
                </Link>
              </p>
              <p className="login-form__row">
                <Link href="/login" className="login-form__link">
                  Voltar ao login
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
