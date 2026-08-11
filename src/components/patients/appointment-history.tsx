import { Badge, Button, EmptyState } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export type AppointmentHistoryItem = {
  id: string;
  status: string;
  occurredAt: string | Date;
  paidAmount: string | number | { toString(): string };
  benefitUsed: string | number | { toString(): string };
  cashbackGenerated: string | number | { toString(): string };
  professionalName?: string | null;
  procedure?: { id: string; name: string } | null;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    lineTotal: string | number | { toString(): string };
  }>;
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
  onEdit,
}: {
  patientName?: string;
  items: AppointmentHistoryItem[];
  className?: string;
  onEdit?: (appointmentId: string) => void;
}) {
  return (
    <section className={cn("patient-detail__panel", className)}>
      <div className="patient-detail__panel-head">
        <div>
          <h3 className="patient-detail__panel-title">
            Histórico de atendimento
          </h3>
          <p className="patient-detail__panel-desc">
            {patientName
              ? `Últimos atendimentos de ${patientName}`
              : "Últimos atendimentos deste paciente"}
          </p>
        </div>
        {items.length > 0 ? (
          <span className="patient-detail__panel-count">
            {items.length} registro{items.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          titulo="Sem atendimentos"
          descricao="Este paciente ainda não possui histórico de atendimento nesta clínica."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Procedimento</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium tabular">Pago</th>
                <th className="py-2 pr-3 font-medium tabular">Benefício</th>
                <th className="py-2 pr-3 font-medium tabular">Cashback</th>
                {onEdit ? (
                  <th className="py-2 font-medium">Ações</th>
                ) : null}
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
                    {item.items && item.items.length > 0 ? (
                      <span>
                        {item.items
                          .map((line) =>
                            line.quantity > 1
                              ? `${line.quantity}x ${line.name}`
                              : line.name,
                          )
                          .join(", ")}
                      </span>
                    ) : (
                      (item.procedure?.name ?? "—")
                    )}
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
                    {formatBRL(String(item.paidAmount))}
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {formatBRL(String(item.benefitUsed))}
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {formatBRL(String(item.cashbackGenerated))}
                  </td>
                  {onEdit ? (
                    <td className="py-3">
                      {item.status === "CONFIRMED" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onEdit(item.id)}
                        >
                          Editar
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
