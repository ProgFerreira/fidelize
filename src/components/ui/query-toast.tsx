"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast-provider";

type Tipo = "sucesso" | "erro" | "aviso" | "info";

const TOAST_FN: Record<Tipo, (mensagem: string, descricao?: string) => void> = {
  sucesso: toast.success,
  erro: toast.error,
  aviso: toast.warning,
  info: toast.info,
};

export function QueryToast({
  param = "ok",
  mensagens,
}: {
  param?: string;
  mensagens: Record<string, { tipo?: Tipo; mensagem: string; descricao?: string }>;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const valor = params.get(param);
    if (!valor) return;
    const usado = mensagens[valor];
    if (!usado) return;
    TOAST_FN[usado.tipo ?? "sucesso"](usado.mensagem, usado.descricao);
    const next = new URLSearchParams(params.toString());
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // mensagens is a stable page-level constant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, params, pathname, router]);

  return null;
}
