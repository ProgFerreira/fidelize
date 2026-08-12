"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button, Campo, Input } from "@/components/ui";

export function LoginForm({
  organizationSlug,
  hostTipo,
}: {
  organizationSlug?: string | null;
  hostTipo?: "organizacao" | "plataforma" | "indefinido";
}) {
  const [email, setEmail] = useState(
    hostTipo === "plataforma" ? "admin@plataforma.local" : "admin@dermaphios.com",
  );
  const [password, setPassword] = useState("Admin@123");
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
        } else {
          setError("E-mail ou senha incorretos.");
        }
        return;
      }

      window.location.assign(
        hostTipo === "plataforma" ? "/organizacoes" : "/dashboard",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha no login";
      if (message.includes("MFA_REQUIRED")) {
        setNeedsMfa(true);
        setError("Informe o código MFA.");
      } else if (message.includes("ORGANIZATION_SUSPENDED")) {
        setError("Organização suspensa.");
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
      {hostTipo === "indefinido" ? (
        <Campo label="Slug da organização" obrigatorio>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="dermaphios"
            required
          />
        </Campo>
      ) : null}
      <Campo label="E-mail" obrigatorio>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          placeholder="seu@email.com"
        />
      </Campo>
      <Campo label="Senha" obrigatorio>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
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
        Acesso restrito à equipe autorizada da clínica.
      </p>
    </form>
  );
}
