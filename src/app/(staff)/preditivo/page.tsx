import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  listHighRiskPatients,
  listForecasts,
} from "@/lib/predictive";
import { PageHeader, Card, Badge, Button, StatCard } from "@/components/ui";
import { runPredictionsAction, runForecastAction } from "@/app/v2-actions";
import { formatBRL } from "@/lib/money";

export default async function PreditivoPage() {
  const session = await requirePermission(PERMISSIONS.PREDICTIVE_VIEW);
  const clinicId = session.clinicId;
  const [risks, forecasts] = await Promise.all([
    listHighRiskPatients(clinicId).catch(() => []),
    listForecasts(clinicId).catch(() => []),
  ]);

  return (
    <div>
      <PageHeader
        title="Inteligência preditiva"
        description="Risco de churn, abandono de saldo e previsão de faturamento (heurística comercial)."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <form action={runPredictionsAction}>
          <Button type="submit" variant="gold">Recalcular scores</Button>
        </form>
        <form action={runForecastAction}>
          <Button type="submit" variant="secondary">Gerar previsão 3 meses</Button>
        </form>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {forecasts.slice(0, 3).map((f) => (
          <StatCard
            key={f.id}
            label={f.periodStart.toISOString().slice(0, 7)}
            value={formatBRL(f.predictedRevenue)}
          />
        ))}
      </div>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold">Pacientes em risco</h2>
        <div className="mt-3 space-y-2">
          {risks.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum score ainda. Execute o recálculo.
            </p>
          ) : (
            risks.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">{r.patient.fullName}</p>
                  <p className="text-xs text-slate-400">{r.patient.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span>Score {String(r.score)}</span>
                  <Badge tone={r.band === "HIGH" ? "danger" : "muted"}>
                    {r.band ?? "—"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
