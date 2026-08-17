import { ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded bg-slate-200", className)}
    />
  );
}

export function SkeletonTabela({
  linhas = 8,
  colunas = 5,
}: {
  linhas?: number;
  colunas?: number;
}) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-10 w-64" />
      <div className="rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 p-4">
          <div className="flex gap-4">
            {Array.from({ length: colunas }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: linhas }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 border-b border-slate-100 p-4 last:border-0"
          >
            {Array.from({ length: colunas }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  titulo,
  descricao,
  title,
  description,
  acao,
  icone: Icone = Inbox,
}: {
  titulo?: string;
  descricao?: string;
  title?: string;
  description?: string;
  acao?: React.ReactNode;
  icone?: typeof Inbox;
}) {
  const t = titulo ?? title ?? "Sem registros";
  const d = descricao ?? description;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center">
      <div className="rounded-full bg-slate-100 p-3">
        <Icone className="h-6 w-6 text-slate-400" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-900">{t}</h3>
      {d && <p className="mt-1 max-w-sm text-sm text-slate-500">{d}</p>}
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}

export function Breadcrumbs({
  itens,
}: {
  itens: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Trilha de navegação">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {itens.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="hover:text-slate-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-900" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CabecalhoPagina({
  titulo,
  descricao,
  breadcrumbs,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  breadcrumbs?: { label: string; href?: string }[];
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3">
      {breadcrumbs && <Breadcrumbs itens={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
          {descricao && (
            <p className="mt-1 text-sm text-slate-500">{descricao}</p>
          )}
        </div>
        {acoes && <div className="flex shrink-0 gap-2">{acoes}</div>}
      </div>
    </div>
  );
}

/** Alias compatível */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <CabecalhoPagina titulo={title} descricao={description} acoes={actions} />
  );
}

type CorBadge = "cinza" | "azul" | "verde" | "ambar" | "vermelho" | "roxo";

const CORES_BADGE: Record<CorBadge, string> = {
  cinza: "bg-slate-100 text-slate-700",
  azul: "bg-blue-100 text-blue-800",
  verde: "bg-green-100 text-green-800",
  ambar: "bg-blue-100 text-blue-800",
  vermelho: "bg-red-100 text-red-800",
  roxo: "bg-purple-100 text-purple-800",
};

const TONE_ALIAS: Record<string, CorBadge> = {
  navy: "azul",
  gold: "azul",
  success: "verde",
  danger: "vermelho",
  warning: "ambar",
  muted: "cinza",
  cinza: "cinza",
  azul: "azul",
  verde: "verde",
  ambar: "ambar",
  vermelho: "vermelho",
  roxo: "roxo",
};

export function Badge({
  children,
  cor = "cinza",
  tone,
  className,
}: {
  children: React.ReactNode;
  cor?: CorBadge | string;
  tone?: string;
  className?: string;
}) {
  const raw = tone ?? cor;
  const chave = (TONE_ALIAS[raw] ?? (raw in CORES_BADGE ? raw : "cinza")) as CorBadge;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        CORES_BADGE[chave],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CorKpi = CorBadge | "marca";

/** Cor do círculo de ícone. Independente de CORES_BADGE (aquela é pra pill de texto). */
const CORES_KPI_ICONE: Record<CorKpi, string> = {
  cinza: "bg-slate-100 text-slate-600",
  azul: "bg-brand-blue/10 text-brand-blue",
  marca: "bg-brand-gold/15 text-brand-gold-dark",
  verde: "bg-emerald-50 text-emerald-700",
  ambar: "bg-amber-50 text-amber-700",
  vermelho: "bg-red-50 text-red-700",
  roxo: "bg-purple-50 text-purple-700",
};

export function CardKpi({
  titulo,
  valor,
  detalhe,
  icone: Icone,
  cor = "azul",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone?: typeof Inbox;
  cor?: CorKpi;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {titulo}
        </p>
        {Icone && (
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              CORES_KPI_ICONE[cor],
            )}
          >
            <Icone className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>
      <p className="mt-2.5 text-2xl font-bold tracking-tight text-brand-navy tabular-nums">
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </Card>
  );
}

/** Selo pequeno com ícone, para usar em `acoes` de CabecalhoPagina. */
export function IconTag({
  icone: Icone,
  children,
  className,
}: {
  icone: typeof Inbox;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/15 px-3 py-1.5 text-xs font-semibold tracking-wide text-brand-gold-dark uppercase",
        className,
      )}
    >
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

/** Card ícone circular + título + descrição — pra grades de destaques/benefícios. */
export function IconFeature({
  icone: Icone,
  titulo,
  descricao,
  className,
}: {
  icone: typeof Inbox;
  titulo: string;
  descricao: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-gold/15 text-brand-gold-dark">
        <Icone className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-navy">{titulo}</p>
        <p className="mt-0.5 text-[0.8rem] leading-snug text-slate-500">
          {descricao}
        </p>
      </div>
    </div>
  );
}

/** Alias compatível */
export function StatCard({
  label,
  value,
  hint,
  icone,
  cor,
}: {
  label: string;
  value: string;
  hint?: string;
  icone?: typeof Inbox;
  cor?: CorKpi;
}) {
  return (
    <CardKpi
      titulo={label}
      valor={value}
      detalhe={hint}
      icone={icone}
      cor={cor}
    />
  );
}
