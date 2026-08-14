import { CabecalhoPagina, Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando dashboard">
      <CabecalhoPagina titulo="Dashboard" descricao="Carregando indicadores…" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
