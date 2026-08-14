"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button, Campo, Input } from "@/components/ui";
import { confirmPasswordResetAction } from "@/app/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await confirmPasswordResetAction({
        token,
        password,
        confirmPassword,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/login?senha=redefinida");
    } catch {
      setError("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form" noValidate>
      <Campo label="Nova senha" obrigatorio>
        <div className="login-form__control">
          <Lock className="login-form__control-icon" aria-hidden />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
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
      <Campo label="Confirmar senha" obrigatorio>
        <div className="login-form__control">
          <Lock className="login-form__control-icon" aria-hidden />
          <Input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            className="login-form__control-input login-form__control-input--password"
          />
          <button
            type="button"
            className="login-form__reveal"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
          >
            {showConfirm ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        </div>
      </Campo>
      {error ? (
        <p role="alert" className="login-form__error">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        carregando={loading}
        className="login-form__submit w-full"
      >
        Redefinir senha
      </Button>
      <p className="login-form__row">
        <Link href="/login" className="login-form__link">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
