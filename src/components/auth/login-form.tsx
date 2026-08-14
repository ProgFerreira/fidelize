"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, getSession } from "next-auth/react";
import { Building2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button, Campo, Input } from "@/components/ui";
import { destinoAposLogin } from "@/lib/auth/post-login";

export function LoginForm({
  organizationSlug,
  hostTipo,
  senhaRedefinida = false,
}: {
  organizationSlug?: string | null;
  hostTipo?: "organizacao" | "plataforma" | "indefinido";
  senhaRedefinida?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState(organizationSlug ?? "");

  useEffect(() => {
    if (organizationSlug) setSlug(organizationSlug);
  }, [organizationSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        mfaCode,
        organizationSlug: hostTipo === "plataforma" ? "" : slug,
        redirect: false,
      });

      if (result?.error) {
        if (
          result.error.includes("MFA_REQUIRED") ||
          result.code === "MFA_REQUIRED"
        ) {
          setNeedsMfa(true);
          setError("Informe o código MFA.");
        } else if (result.error.includes("ORGANIZATION_SUSPENDED")) {
          setError("Organização suspensa.");
        } else if (result.error.includes("TOO_MANY_ATTEMPTS")) {
          setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        } else {
          setError("E-mail ou senha incorretos.");
        }
        return;
      }

      const session = await getSession();
      window.location.assign(destinoAposLogin(session?.user));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha no login";
      if (message.includes("MFA_REQUIRED")) {
        setNeedsMfa(true);
        setError("Informe o código MFA.");
      } else if (message.includes("ORGANIZATION_SUSPENDED")) {
        setError("Organização suspensa.");
      } else if (message.includes("TOO_MANY_ATTEMPTS")) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form" noValidate>
      {hostTipo === "organizacao" && slug ? (
        <p className="login-form__hint login-form__hint--org">
          Organização: <strong>{slug}</strong>
        </p>
      ) : null}
      {hostTipo === "plataforma" ? (
        <p className="login-form__hint login-form__hint--platform">
          Acesso da plataforma
        </p>
      ) : null}
      {senhaRedefinida ? (
        <p role="status" className="login-form__hint login-form__hint--ok">
          Senha redefinida. Entre com a nova senha.
        </p>
      ) : null}
      {hostTipo === "indefinido" ? (
        <Campo label="Slug da organização" obrigatorio>
          <div className="login-form__control">
            <Building2 className="login-form__control-icon" aria-hidden />
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="Ex.: minha-clinica"
              required
              className="login-form__control-input"
            />
          </div>
        </Campo>
      ) : null}
      <Campo label="E-mail" obrigatorio>
        <div className="login-form__control">
          <Mail className="login-form__control-icon" aria-hidden />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="seu@email.com"
            className="login-form__control-input"
          />
        </div>
      </Campo>
      <Campo label="Senha" obrigatorio>
        <div className="login-form__control">
          <Lock className="login-form__control-icon" aria-hidden />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="login-form__control-input login-form__control-input--password"
          />
          <button
            type="button"
            className="login-form__reveal"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        </div>
      </Campo>
      <div className="login-form__row">
        <Link href="/recuperar-senha" className="login-form__link">
          Esqueceu a senha?
        </Link>
      </div>
      {needsMfa ? (
        <Campo label="Código MFA">
          <Input
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="000000"
            className="tabular text-center text-lg tracking-[0.3em]"
          />
        </Campo>
      ) : null}
      {error ? (
        <p role="alert" className="login-form__error">
          {error}
        </p>
      ) : null}
      <Button type="submit" carregando={loading} className="login-form__submit w-full">
        Entrar
      </Button>
      <p className="login-form__footer">
        <Lock aria-hidden />
        Acesso restrito e seguro.
      </p>
    </form>
  );
}
