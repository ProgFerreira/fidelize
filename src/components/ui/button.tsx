import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variante = "primario" | "secundario" | "perigo" | "fantasma" | "contorno" | "gold";
type Tamanho = "sm" | "md" | "lg" | "icone";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-brand-blue text-white hover:bg-blue-700 focus-visible:outline-brand-blue",
  gold:
    "bg-brand-gold text-white hover:bg-brand-gold-dark focus-visible:outline-brand-gold",
  secundario: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  perigo: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
  fantasma: "text-slate-700 hover:bg-slate-100",
  contorno:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
  icone: "h-10 w-10 justify-center",
};

const VARIANT_ALIAS: Record<string, Variante> = {
  primary: "primario",
  gold: "gold",
  ghost: "fantasma",
  danger: "perigo",
  outline: "contorno",
  secondary: "secundario",
  primario: "primario",
  secundario: "secundario",
  perigo: "perigo",
  fantasma: "fantasma",
  contorno: "contorno",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Alias compatível com código anterior */
  variant?: string;
  tamanho?: Tamanho;
  /** Alias inglês */
  size?: Tamanho;
  carregando?: boolean;
}

export function classesBotao({
  variante,
  variant,
  tamanho,
  size,
  className,
}: {
  variante?: Variante;
  variant?: string;
  tamanho?: Tamanho;
  size?: Tamanho;
  className?: string;
}) {
  const resolved =
    variante ??
    VARIANT_ALIAS[variant ?? "primario"] ??
    ("primario" as Variante);
  const sizeResolved = tamanho ?? size ?? "md";
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTES[resolved],
    TAMANHOS[sizeResolved],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variante,
      variant,
      tamanho,
      size,
      carregando = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || carregando}
        className={classesBotao({
          variante,
          variant,
          tamanho,
          size,
          className,
        })}
        {...props}
      >
        {carregando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
