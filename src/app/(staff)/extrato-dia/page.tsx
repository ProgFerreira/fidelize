import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { Badge, Button, Campo, Card, Input, PageHeader } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { prisma } from "@/lib/db";
import { getDailyExtract } from "@/lib/reception/daily-extract";
import {
  formatYmdPt,
  resolveExtractPeriod,
  todayYmd,
} from "@/lib/datetime/clinic-day";
import { PrintExtractButton } from "@/components/reception/print-extract-button";

export default async function ExtratoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; de?: string; ate?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const clinic = await prisma.clinic.findFirst({
    where: { id: session.clinicId },
    select: { timezone: true },
  });
  const timezone = clinic?.timezone || "America/Sao_Paulo";
  const params = await searchParams;
  const period = resolveExtractPeriod({
    data: params.data,
    de: params.de,
    ate: params.ate,
    todayYmd: todayYmd(timezone),
  });
  const extract = await getDailyExtract({
    clinicId: session.clinicId,
    fromYmd: period.fromYmd,
    toYmd: period.toYmd,
    timezone,
  });

  return (
    <div className="services-page pdv-extract">
      <PageHeader
        title="Extrato"
        description={
          period.isRange
            ? `Vendas confirmadas de ${formatYmdPt(period.fromYmd)} a ${formatYmdPt(period.toYmd)} · fuso ${timezone.replace("_", " ")}`
            : `Vendas confirmadas em ${formatYmdPt(period.fromYmd)} · fuso ${timezone.replace("_", " ")}`
        }
        actions={
          <div className="flex flex-wrap gap-2 pdv-extract__no-print">
            <PrintExtractButton />
            <Link href="/recepcao" className="pdv-extract-link">
              Voltar ao PDV
            </Link>
          </div>
        }
      />

      <form method="get" className="pdv-extract__toolbar">
        <Campo label="De">
          <Input type="date" name="de" defaultValue={period.fromYmd} required />
        </Campo>
        <Campo label="Até">
          <Input type="date" name="ate" defaultValue={period.toYmd} required />
        </Campo>
        <Button type="submit" variant="contorno">
          Ver período
        </Button>
      </form>

      <div className="services-stats">
        <div className="services-stat">
          <p className="services-stat__label">Vendas</p>
          <p className="services-stat__value">{extract.totals.vendas}</p>
        </div>
        <div className="services-stat">
          <p className="services-stat__label">Bruto</p>
          <p className="services-stat__value">
            {formatBRL(extract.totals.bruto)}
          </p>
        </div>
        <div className="services-stat">
          <p className="services-stat__label">Recebido</p>
          <p className="services-stat__value">
            {formatBRL(extract.totals.recebido)}
          </p>
        </div>
        <div className="services-stat">
          <p className="services-stat__label">Benefício</p>
          <p className="services-stat__value">
            {formatBRL(extract.totals.beneficio)}
          </p>
        </div>
      </div>

      {extract.byMethod.length > 0 ? (
        <Card className="pdv-extract__methods">
          <h2>Por forma de pagamento</h2>
          <ul>
            {extract.byMethod.map((row) => (
              <li key={row.method}>
                <span>
                  {row.label}
                  <small>
                    {row.count} lançamento{row.count === 1 ? "" : "s"}
                  </small>
                </span>
                <strong>{formatBRL(row.amount)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {extract.sales.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Nenhuma venda confirmada neste período.
          </p>
        </Card>
      ) : (
        <div className="pdv-extract__table-wrap">
          <table className="pdv-extract__table">
            <thead>
              <tr>
                <th>{period.isRange ? "Data / hora" : "Hora"}</th>
                <th>Paciente</th>
                <th>Itens</th>
                <th>Profissional</th>
                <th>Bruto</th>
                <th>Pago</th>
                <th>Forma</th>
                <th className="pdv-extract__no-print">Ação</th>
              </tr>
            </thead>
            <tbody>
              {extract.sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="tabular">
                    {period.isRange ? (
                      <>
                        {formatYmdPt(sale.ymd)}
                        <span className="pdv-extract__meta"> {sale.time}</span>
                      </>
                    ) : (
                      sale.time
                    )}
                  </td>
                  <td>
                    <p className="pdv-extract__name">{sale.patientName}</p>
                    {sale.discountAmount > 0 || sale.benefitUsed > 0 ? (
                      <p className="pdv-extract__meta">
                        {sale.discountAmount > 0
                          ? `Desc. ${formatBRL(sale.discountAmount)}`
                          : ""}
                        {sale.discountAmount > 0 && sale.benefitUsed > 0
                          ? " · "
                          : ""}
                        {sale.benefitUsed > 0
                          ? `Benefício ${formatBRL(sale.benefitUsed)}`
                          : ""}
                      </p>
                    ) : null}
                  </td>
                  <td>{sale.items}</td>
                  <td>{sale.professionalName || "—"}</td>
                  <td className="tabular">{formatBRL(sale.grossAmount)}</td>
                  <td className="tabular">{formatBRL(sale.paidAmount)}</td>
                  <td>
                    <div className="pdv-extract__pays">
                      {sale.payments.length === 0 ? (
                        <Badge tone="muted">—</Badge>
                      ) : (
                        sale.payments.map((p, i) => (
                          <Badge
                            key={`${sale.id}-${p.method}-${i}`}
                            tone={p.method === "gift_card" ? "gold" : "navy"}
                          >
                            {p.label} {formatBRL(p.amount)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="pdv-extract__no-print">
                    <Link
                      href={`/extrato-dia/${sale.id}?de=${period.fromYmd}&ate=${period.toYmd}`}
                      className="pdv-extract-link pdv-extract-link--sm"
                    >
                      Corrigir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
