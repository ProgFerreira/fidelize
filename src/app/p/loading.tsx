import { Skeleton } from "@/components/ui";

export default function PatientLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-52 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
