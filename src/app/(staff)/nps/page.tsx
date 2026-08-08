import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { npsDashboard } from "@/lib/nps";
import { PageHeader, Card, Badge, StatCard } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

export default async function NpsPage() {
  const session = await requirePermission(PERMISSIONS.NPS_VIEW);
  const clinicId = session.clinicId;
  const data = await npsDashboard(clinicId);

  return (
    <div>
      <PageHeader
        title="NPS e satisfação"
        description="Pesquisas pós-atendimento e recuperação de detratores."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="NPS" value={String(data.nps)} />
        <StatCard label="Respostas" value={String(data.total)} />
        <StatCard label="Taxa de resposta" value={`${data.responseRate}%`} />
        <StatCard label="Recuperações pendentes" value={String(data.pendingRecovery)} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Promotores" value={String(data.promoters)} />
        <StatCard label="Neutros" value={String(data.passives)} />
        <StatCard label="Detratores" value={String(data.detractors)} />
      </div>

      {data.monthly.length > 0 ? (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold">Evolução mensal</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4">
            {data.monthly.map((m) => (
              <div key={m.month} className="rounded-md border border-slate-200 p-2 text-sm">
                <p className="text-xs text-slate-400">{m.month}</p>
                <p className="font-semibold">NPS {m.nps}</p>
                <p className="text-slate-500">{m.total} respostas</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <Card>
          <h2 className="font-semibold">Por unidade</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.byUnit.map((u) => (
              <li key={u.name} className="flex justify-between gap-2">
                <span>{u.name}</span>
                <span className="text-slate-500">{u.nps} ({u.total})</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Por profissional</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.byProfessional.map((u) => (
              <li key={u.name} className="flex justify-between gap-2">
                <span>{u.name}</span>
                <span className="text-slate-500">{u.nps} ({u.total})</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Por procedimento</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.byProcedure.map((u) => (
              <li key={u.name} className="flex justify-between gap-2">
                <span>{u.name}</span>
                <span className="text-slate-500">{u.nps} ({u.total})</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-3">
        {data.recent.map((row) => (
          <Card key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Nota {row.score}</p>
                <p className="text-sm text-slate-500">{row.comment ?? "Sem comentário"}</p>
              </div>
              <Badge
                tone={
                  row.classification === "PROMOTER"
                    ? "success"
                    : row.classification === "DETRACTOR"
                      ? "danger"
                      : "muted"
                }
              >
                {labelPt(row.classification)}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
