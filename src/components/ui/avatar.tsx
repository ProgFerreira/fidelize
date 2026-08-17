import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type TamanhoAvatar = "sm" | "md" | "lg";

const TAMANHOS: Record<TamanhoAvatar, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-base shadow-[0_8px_20px_rgba(15,23,42,0.18)]",
};

/** Círculo com as iniciais do nome — mesmo estilo em toda a base de pacientes/usuários. */
export function Avatar({
  nome,
  tamanho = "md",
  className,
}: {
  nome: string;
  tamanho?: TamanhoAvatar;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-navy to-slate-800 font-bold tracking-wide text-white",
        TAMANHOS[tamanho],
        className,
      )}
    >
      {initials(nome)}
    </span>
  );
}
