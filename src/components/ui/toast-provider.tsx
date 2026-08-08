"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type Tipo = "sucesso" | "erro" | "aviso" | "info";

interface ToastItem {
  id: number;
  tipo: Tipo;
  mensagem: string;
  descricao?: string;
}

let proximoId = 1;
let emitir: ((t: Omit<ToastItem, "id">) => void) | null = null;

export const toast = {
  success: (mensagem: string, descricao?: string) =>
    emitir?.({ tipo: "sucesso", mensagem, descricao }),
  error: (mensagem: string, descricao?: string) =>
    emitir?.({ tipo: "erro", mensagem, descricao }),
  warning: (mensagem: string, descricao?: string) =>
    emitir?.({ tipo: "aviso", mensagem, descricao }),
  info: (mensagem: string, descricao?: string) =>
    emitir?.({ tipo: "info", mensagem, descricao }),
};

const ESTILO: Record<Tipo, { classe: string; Icone: typeof Info }> = {
  sucesso: {
    classe: "border-l-4 border-l-green-500",
    Icone: CheckCircle2,
  },
  erro: { classe: "border-l-4 border-l-red-500", Icone: XCircle },
  aviso: { classe: "border-l-4 border-l-amber-500", Icone: AlertTriangle },
  info: { classe: "border-l-4 border-l-blue-500", Icone: Info },
};

const COR_ICONE: Record<Tipo, string> = {
  sucesso: "text-green-500",
  erro: "text-red-500",
  aviso: "text-amber-500",
  info: "text-blue-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    emitir = (t) => setItens((atual) => [...atual, { ...t, id: proximoId++ }]);
    return () => {
      emitir = null;
    };
  }, []);

  const remover = (id: number) =>
    setItens((atual) => atual.filter((t) => t.id !== id));

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {children}

      {itens.map((item) => {
        const { classe, Icone } = ESTILO[item.tipo];
        return (
          <ToastPrimitive.Root
            key={item.id}
            duration={item.tipo === "erro" ? 8000 : 4000}
            onOpenChange={(aberto) => !aberto && remover(item.id)}
            className={cn(
              "flex items-start gap-3 rounded-md bg-white p-4 shadow-lg dark:bg-slate-800",
              classe,
            )}
          >
            <Icone
              className={cn("mt-0.5 h-5 w-5 shrink-0", COR_ICONE[item.tipo])}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {item.mensagem}
              </ToastPrimitive.Title>
              {item.descricao && (
                <ToastPrimitive.Description className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {item.descricao}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Fechar"
              className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}

      <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-md" />
    </ToastPrimitive.Provider>
  );
}
