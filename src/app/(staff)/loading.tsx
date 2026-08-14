import { CabecalhoPagina, Skeleton, SkeletonTabela } from "@/components/ui";

export default function StaffLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <CabecalhoPagina titulo="Carregando" descricao="Preparando a página…" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <SkeletonTabela linhas={6} colunas={4} />
    </div>
  );
}
