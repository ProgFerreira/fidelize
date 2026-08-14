import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getProfessionalCommissions } from "@/lib/commission";
import { CabecalhoPagina, Card, Button, Input, Campo } from "@/components/ui";

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const { mes } = await searchParams;
  const now = new Date();
  const [y, m] = (mes || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const from = new Date(y, (m || 1) - 1, 1);
  const to = new Date(y, m || 1, 0, 23, 59, 59, 999);
  const rows = await getProfessionalCommissions({
    clinicId: session.clinicId,
    from,
    to,
  });

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Comissões"
        descricao="Percentual sobre o valor pago nas vendas do período, por profissional."
      />
      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <Campo label="Mês">
            <Input
              type="month"
              name="mes"
              defaultValue={`${y}-${String(m).padStart(2, "0")}`}
            />
          </Campo>
          <Button type="submit">Filtrar</Button>
        </form>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum profissional com comissão ou venda neste mês.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2">Profissional</th>
                  <th className="py-2">%</th>
                  <th className="py-2">Vendas</th>
                  <th className="py-2">Receita</th>
                  <th className="py-2">Cashback</th>
                  <th className="py-2">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td className="py-2">{row.percent}%</td>
                    <td className="py-2">{row.sales}</td>
                    <td className="py-2">{row.revenue}</td>
                    <td className="py-2">{row.cashback}</td>
                    <td className="py-2 font-semibold">{row.commission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
