"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Mail } from "lucide-react";
import { Button, Campo, Input } from "@/components/ui";
import { requestPasswordResetAction } from "@/app/actions";

export function ForgotPasswordForm({
  organizationSlug,
  hostTipo,
}: {
  organizationSlug?: string | null;
  hostTipo?: "organizacao" | "plataforma" | "indefinido";
}) {
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState(
    organizationSlug ?? (hostTipo === "indefinido" ? "dermaphios" : ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organizationSlug) setSlug(organizationSlug);
  }, [organizationSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await requestPasswordResetAction({
        email,
        organizationSlug: hostTipo === "plataforma" ? "" : slug,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message);
    } catch {
      setError("Não foi possível enviar o pedido. Tente novamente.");
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
          <div className="login-form__control">
            <Building2 className="login-form__control-icon" aria-hidden />
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="Ex.: dermaphios"
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
      {error ? (
        <p role="alert" className="login-form__error">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="login-form__hint login-form__hint--ok">
          {success}
        </p>
      ) : null}
      <Button
        type="submit"
        carregando={loading}
        disabled={Boolean(success)}
        className="login-form__submit w-full"
      >
        Enviar link
      </Button>
      <p className="login-form__row">
        <Link href="/login" className="login-form__link">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
