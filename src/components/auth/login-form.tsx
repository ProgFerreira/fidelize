"use client";

import { useEffect, useState } from "react";
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {hostTipo === "organizacao" && slug ? (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Organização: <strong>{slug}</strong>
        </p>
      ) : null}
      {hostTipo === "plataforma" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
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
        />
      </Campo>
      <Campo label="Senha" obrigatorio>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </Campo>
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
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" carregando={loading} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
