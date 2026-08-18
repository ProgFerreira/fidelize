"use client";

import { useState, useTransition } from "react";
import { Button, Campo, Input } from "@/components/ui";
import { requestOtpAction, verifyOtpAction } from "@/app/patient-actions";

export function PatientLoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [simulatedCode, setSimulatedCode] = useState<string | undefined>();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmitPhone(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("phone", phone);
      const result = await requestOtpAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSimulatedCode(
        process.env.NODE_ENV === "production" ? undefined : result.simulatedCode,
      );
      setStep("code");
    });
  }

  function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("phone", phone);
      fd.set("code", code);
      if (callbackUrl) fd.set("callbackUrl", callbackUrl);
      const result = await verifyOtpAction(fd);
      // Em caso de sucesso, verifyOtpAction redireciona e não retorna nada.
      if (result && !result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="login-form">
      {step === "phone" ? (
        <form className="space-y-4" onSubmit={onSubmitPhone}>
          <Campo label="Telefone" obrigatorio>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              required
            />
          </Campo>
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" carregando={pending}>
            Receber código
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={onSubmitCode}>
          <Campo label="Código" obrigatorio>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="tabular text-center text-lg tracking-[0.3em]"
            />
          </Campo>
          {simulatedCode && process.env.NODE_ENV !== "production" ? (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Código de desenvolvimento: <strong>{simulatedCode}</strong>
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" carregando={pending}>
            Entrar
          </Button>
        </form>
      )}
    </div>
  );
}
