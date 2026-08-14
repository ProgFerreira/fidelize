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

  return (
    <div className="login-form">
      {step === "phone" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setError(null);
              try {
                const fd = new FormData();
                fd.set("phone", phone);
                const result = await requestOtpAction(fd);
                setSimulatedCode(
                  process.env.NODE_ENV === "production"
                    ? undefined
                    : result.simulatedCode,
                );
                setStep("code");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Falha ao enviar código",
                );
              }
            });
          }}
        >
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
        <form action={verifyOtpAction} className="space-y-4">
          <input type="hidden" name="phone" value={phone} />
          {callbackUrl ? (
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
          ) : null}
          <Campo label="Código" obrigatorio>
            <Input
              name="code"
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
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      )}
    </div>
  );
}
