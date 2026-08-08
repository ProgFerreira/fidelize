import { ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded bg-slate-200 dark:bg-slate-800",
        className,
      )}
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
      <div className="rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex gap-4">
            {Array.from({ length: colunas }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: linhas }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800/50"
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700">
      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
        <Icone className="h-6 w-6 text-slate-400" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">
        {t}
      </h3>
      {d && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {d}
        </p>
      )}
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
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        {itens.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-slate-900 hover:underline dark:hover:text-slate-100"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="font-medium text-slate-900 dark:text-slate-100"
                aria-current="page"
              >
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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {titulo}
          </h1>
          {descricao && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {descricao}
            </p>
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
  cinza: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  azul: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  verde: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  ambar: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  vermelho: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  roxo: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

const TONE_ALIAS: Record<string, CorBadge> = {
  navy: "azul",
  gold: "ambar",
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
        "rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

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
  cor?: CorBadge;
}) {
  return (
    <Card className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular text-slate-900 dark:text-slate-100">
          {valor}
        </p>
        {detalhe && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {detalhe}
          </p>
        )}
      </div>
      {Icone && (
        <div className={cn("rounded-lg p-2.5", CORES_BADGE[cor])}>
          <Icone className="h-5 w-5" aria-hidden />
        </div>
      )}
    </Card>
  );
}

/** Alias compatível */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return <CardKpi titulo={label} valor={value} detalhe={hint} />;
}
