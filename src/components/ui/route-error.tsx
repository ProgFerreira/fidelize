"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, classesBotao } from "@/components/ui/button";

export function RouteError({
  error,
  retry,
  reset,
  titulo = "Não foi possível carregar",
  descricao = "Ocorreu um erro ao abrir esta página. Tente de novo em instantes.",
  homeHref = "/",
  homeLabel = "Voltar",
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
  titulo?: string;
  descricao?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  const tentarDeNovo = retry ?? reset;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {titulo}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-400">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {tentarDeNovo ? (
          <Button type="button" variant="gold" onClick={tentarDeNovo}>
            Tentar novamente
          </Button>
        ) : null}
        <Link href={homeHref} className={classesBotao({ variante: "contorno" })}>
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
