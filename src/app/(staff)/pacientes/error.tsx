"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, classesBotao } from "@/components/ui";

export default function PacientesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[pacientes]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="patients-page" style={{ padding: "2rem 0" }}>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Não foi possível carregar
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Ocorreu um erro no servidor ao abrir esta página. Isso costuma ser
        temporário (banco lento ou sessão sem organização). Tente de novo.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-400">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variante="gold" onClick={retry}>
          Tentar novamente
        </Button>
        <Link href="/pacientes" className={classesBotao({ variante: "contorno" })}>
          Voltar à lista
        </Link>
      </div>
    </div>
  );
}
