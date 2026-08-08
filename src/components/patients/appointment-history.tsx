import { Badge, Card, EmptyState } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";

export type AppointmentHistoryItem = {
  id: string;
  status: string;
  occurredAt: string | Date;
  paidAmount: string | number;
  benefitUsed: string | number;
  cashbackGenerated: string | number;
  professionalName?: string | null;
  procedure?: { id: string; name: string } | null;
};

function statusTone(status: string) {
  if (status === "CONFIRMED") return "success";
  if (status === "CANCELLED" || status === "REVERSED") return "danger";
  return "muted";
}

export function AppointmentHistoryCard({
  patientName,
  items,
  className,
}: {
  patientName?: string;
  items: AppointmentHistoryItem[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl">Histórico de atendimento</h2>
          <p className="mt-1 text-sm text-slate-500">
            {patientName
              ? `Últimos atendimentos de ${patientName}`
              : "Últimos atendimentos deste paciente"}
          </p>
        </div>
        {items.length > 0 ? (
          <p className="text-sm text-slate-500">
            {items.length} registro{items.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            titulo="Sem atendimentos"
            descricao="Este paciente ainda não possui histórico de atendimento nesta clínica."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Procedimento</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium tabular">Pago</th>
                <th className="py-2 pr-3 font-medium tabular">Benefício</th>
                <th className="py-2 font-medium tabular">Cashback</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {new Date(item.occurredAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 pr-3">
                    {item.procedure?.name ?? "—"}
                    {item.professionalName ? (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {item.professionalName}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge tone={statusTone(item.status)}>
                      {labelPt(item.status)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {formatBRL(item.paidAmount)}
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {formatBRL(item.benefitUsed)}
                  </td>
                  <td className="py-3 tabular">
                    {formatBRL(item.cashbackGenerated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
