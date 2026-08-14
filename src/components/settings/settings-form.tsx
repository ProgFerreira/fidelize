"use client";

import { useState, useTransition } from "react";
import { Button, Input, toast, Campo } from "@/components/ui";
import { saveSettingsAction } from "@/app/actions";
import type { BenefitSettings } from "@/lib/cashback";

export function SettingsForm({ initial }: { initial: BenefitSettings }) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BenefitSettings>(
    key: K,
    value: BenefitSettings[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  }

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          setSaved(false);
          try {
            const result = await saveSettingsAction(settings);
            if (!result.ok) {
              setError(result.error);
              toast.error("Falha ao salvar", result.error);
              return;
            }
            setSaved(true);
            toast.success("Configurações salvas");
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : "Não foi possível salvar as configurações.";
            setError(message);
            toast.error("Falha ao salvar", message);
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Cashback padrão %">
          <Input
            type="number"
            step="0.01"
            value={settings.defaultCashbackPercent}
            onChange={(e) =>
              update("defaultCashbackPercent", Number(e.target.value))
            }
          />
        </Campo>
        <Campo label="Pontos por real">
          <Input
            type="number"
            step="0.01"
            value={settings.pointsPerReal}
            onChange={(e) => update("pointsPerReal", Number(e.target.value))}
          />
        </Campo>
        <Campo label="Dias para liberação">
          <Input
            type="number"
            value={settings.releaseDays}
            onChange={(e) => update("releaseDays", Number(e.target.value))}
          />
        </Campo>
        <Campo label="Validade (dias)">
          <Input
            type="number"
            value={settings.validityDays}
            onChange={(e) => update("validityDays", Number(e.target.value))}
          />
        </Campo>
        <div className="sm:col-span-2">
          <Campo label="Limite de resgate no atendimento %">
            <Input
              type="number"
              value={settings.maxRedemptionPercent ?? ""}
              onChange={(e) =>
                update(
                  "maxRedemptionPercent",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Campo>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar regras"}
        </Button>
        {saved ? (
          <p className="text-sm text-green-700">Configurações salvas.</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
