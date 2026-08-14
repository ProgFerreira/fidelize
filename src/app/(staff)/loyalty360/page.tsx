import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina, Card, Badge, classesBotao } from "@/components/ui";
import { getLoyalty360Snapshot } from "@/lib/loyalty360";

export default async function Loyalty360Page() {
  const session = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const snapshot = await getLoyalty360Snapshot(session.clinicId);

  return (
    <div>
      <CabecalhoPagina
        titulo="Loyalty 360 clínico"
        descricao="Pós-consulta → NPS → indicação → recuperação, em um só pipeline."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {snapshot.pipeline.map((step) => (
          <Card key={step.id}>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {step.label}
            </p>
            <p className="mt-2 text-3xl font-semibold">{step.value}</p>
            <Link
              href={step.href}
              className={classesBotao({ tamanho: "sm", variante: "contorno", className: "mt-3" })}
            >
              Abrir
            </Link>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Alto risco de churn</h2>
          <Badge>Preditivo</Badge>
        </div>
        {snapshot.highRiskPatients.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum paciente de alto risco no momento (ou módulo preditivo
            inativo).
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {snapshot.highRiskPatients.map((row) => (
              <li key={row.id} className="flex justify-between gap-2">
                <Link
                  className="text-blue-700 hover:underline"
                  href={`/pacientes/${row.patient.id}`}
                >
                  {row.patient.fullName}
                </Link>
                <span className="tabular text-slate-500">
                  {Number(row.score).toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
