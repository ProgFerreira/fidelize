import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRecoveryCases } from "@/lib/recovery";
import { CabecalhoPagina, Card, Badge, Button, StatCard } from "@/components/ui";
import { runRecoveryAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function RecuperacaoPage() {
  const session = await requirePermission(PERMISSIONS.RECOVERY_MANAGE);
  const clinicId = session.clinicId;
  const cases = await listRecoveryCases(clinicId);
  const counts = {
    ATTENTION: cases.filter((c) => c.status === "ATTENTION").length,
    RISK: cases.filter((c) => c.status === "RISK").length,
    INACTIVE: cases.filter((c) => c.status === "INACTIVE").length,
    RECOVERED: cases.filter((c) => c.status === "RECOVERED").length,
  };

  return (
    <div>
      <CabecalhoPagina
        titulo="Recuperação de inativos"
        descricao="Classificação automática e réguas de retorno."
      />
      <form action={runRecoveryAction} className="mb-4">
        <Button type="submit" variante="secundario">Recalcular inatividade</Button>
      </form>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Atenção" value={String(counts.ATTENTION)} />
        <StatCard label="Risco" value={String(counts.RISK)} />
        <StatCard label="Inativos" value={String(counts.INACTIVE)} />
        <StatCard label="Recuperados" value={String(counts.RECOVERED)} />
      </div>
      <div className="space-y-3">
        {cases.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{item.patient.fullName}</p>
                <p className="text-sm text-slate-500">
                  {item.inactiveDays} dias · {item.patient.phone}
                </p>
                {item.notes && (
                  <p className="mt-1 text-sm text-slate-600">{item.notes}</p>
                )}
              </div>
              <Badge
                tone={
                  item.status === "RECOVERED"
                    ? "success"
                    : item.status === "INACTIVE"
                      ? "danger"
                      : "warning"
                }
              >
                {labelPt(item.status)}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
