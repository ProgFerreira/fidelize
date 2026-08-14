import { CabecalhoPagina, Skeleton } from "@/components/ui";

export default function RecepcaoLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando recepção">
      <CabecalhoPagina
        titulo="Recepção"
        descricao="Preparando o atendimento…"
      />
      <div className="grid gap-4 xl:grid-cols-12">
        <Skeleton className="h-80 rounded-xl xl:col-span-3" />
        <Skeleton className="h-80 rounded-xl xl:col-span-5" />
        <Skeleton className="h-80 rounded-xl xl:col-span-4" />
      </div>
    </div>
  );
}
