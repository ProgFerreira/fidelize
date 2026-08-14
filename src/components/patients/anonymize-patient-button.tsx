"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { staffAnonymizePatientLgpdAction } from "@/app/v2-actions";
import { toast } from "@/components/ui";

export function AnonymizePatientButton({ patientId }: { patientId: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variante="perigo"
      tamanho="sm"
      carregando={pending}
      onClick={() => {
        const ok = window.confirm(
          "A anonimização remove dados identificáveis do titular e é irreversível. Continuar?",
        );
        if (!ok) return;
        start(async () => {
          const fd = new FormData();
          fd.set("patientId", patientId);
          try {
            await staffAnonymizePatientLgpdAction(fd);
            toast.success("Titular anonimizado");
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Falha ao anonimizar titular",
            );
          }
        });
      }}
    >
      Anonimizar titular
    </Button>
  );
}
