"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import {
  anonymizeMyDataAction,
  exportMyDataAction,
} from "@/app/patient-actions";

export function LgpdPatientActions() {
  const [pending, start] = useTransition();
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variante="secundario"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                const data = await exportMyDataAction();
                setExportJson(JSON.stringify(data, null, 2));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha na exportação");
              }
            });
          }}
        >
          Exportar meus dados
        </Button>
        <Button
          type="button"
          variante="perigo"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "Isso anonimiza seus dados pessoais e encerra o acesso ao portal. Continuar?",
              )
            ) {
              return;
            }
            setError(null);
            start(async () => {
              try {
                await anonymizeMyDataAction();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha na exclusão");
              }
            });
          }}
        >
          Solicitar exclusão (anonimizar)
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {exportJson ? (
        <pre className="max-h-80 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {exportJson}
        </pre>
      ) : null}
    </div>
  );
}
