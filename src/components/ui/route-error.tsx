"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, classesBotao } from "@/components/ui/button";
import {
  isBancoIndisponivel,
  MSG_BANCO_INDISPONIVEL,
} from "@/lib/db-errors";

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
  const bancoFora = isBancoIndisponivel(error);
  const tituloExibido = bancoFora ? "MySQL indisponível" : titulo;
  const descricaoExibida = bancoFora ? MSG_BANCO_INDISPONIVEL : descricao;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {tituloExibido}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {descricaoExibida}
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-400">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {tentarDeNovo ? (
          <Button type="button" variante="gold" onClick={tentarDeNovo}>
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
