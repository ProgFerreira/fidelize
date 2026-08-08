"use client";

import { useState, useTransition } from "react";
import { Button, Card, Campo, Input } from "@/components/ui";
import { requestOtpAction, verifyOtpAction } from "@/app/patient-actions";

export function PatientLoginForm() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [simulatedCode, setSimulatedCode] = useState<string | undefined>();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="w-full max-w-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
        Portal do paciente
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Seu clube Dermaphios
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Acesse com telefone e código temporário.
      </p>

      {step === "phone" ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setError(null);
              try {
                const fd = new FormData();
                fd.set("phone", phone);
                const result = await requestOtpAction(fd);
                setSimulatedCode(result.simulatedCode);
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
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" carregando={pending}>
            Receber código
          </Button>
        </form>
      ) : (
        <form action={verifyOtpAction} className="mt-6 space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <Campo label="Código" obrigatorio>
            <Input
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="tabular text-center text-lg tracking-[0.3em]"
            />
          </Campo>
          {simulatedCode ? (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Código simulado (v1): <strong>{simulatedCode}</strong>
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
      )}
    </Card>
  );
}
