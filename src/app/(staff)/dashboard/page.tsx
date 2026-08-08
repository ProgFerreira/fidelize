import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { DashboardCharts } from "@/components/dashboard/charts";
import { advancedDashboardMetrics } from "@/lib/metrics";
import { CREDIT_LEDGER_TYPES } from "@/lib/ledger";
import { Prisma } from "@/generated/prisma/client";

export default async function DashboardPage() {
  const session = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const clinicId = session.clinicId;

  const [
    activePatients,
    newPatients,
    creditAgg,
    debitAgg,
    expiredAgg,
    walletAgg,
    pointsAgg,
    categoryGroups,
    monthlyCredits,
    monthlyDebits,
    advanced,
  ] = await Promise.all([
    prisma.patient.count({ where: { clinicId, status: "ACTIVE" } }),
    prisma.patient.count({
      where: {
        clinicId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        clinicId,
        type: { in: CREDIT_LEDGER_TYPES },
        status: { in: ["COMPLETED", "PENDING"] },
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { clinicId, type: "DEBIT_REDEMPTION", status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { clinicId, type: "DEBIT_EXPIRATION", status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.wallet.aggregate({
      where: { clinicId, status: "ACTIVE" },
      _sum: { availableBalance: true },
    }),
    prisma.wallet.aggregate({
      where: { clinicId, status: "ACTIVE" },
      _sum: { pointsBalance: true },
    }),
    prisma.wallet.groupBy({
      by: ["categoryId"],
      where: { clinicId, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ month: string; total: string }>>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, SUM(amount) as total
      FROM LedgerEntry
      WHERE clinicId = ${clinicId}
        AND type IN (${Prisma.join(CREDIT_LEDGER_TYPES)})
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month ASC
      LIMIT 12
    `,
    prisma.$queryRaw<Array<{ month: string; total: string }>>`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, SUM(amount) as total
      FROM LedgerEntry
      WHERE clinicId = ${clinicId}
        AND type = 'DEBIT_REDEMPTION'
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month ASC
      LIMIT 12
    `,
    advancedDashboardMetrics(clinicId).catch(() => null),
  ]);

  const categories = await prisma.category.findMany({
    where: { clinicId },
  });
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const patientsByCategory = categoryGroups.map((g) => ({
    name: g.categoryId ? categoryMap[g.categoryId] ?? "Sem categoria" : "Sem categoria",
    value: g._count._all,
  }));

  const months = Array.from(
    new Set([
      ...monthlyCredits.map((m) => m.month),
      ...monthlyDebits.map((m) => m.month),
    ]),
  ).sort();

  const cashbackSeries = months.map((month) => ({
    month,
    gerado: Number(monthlyCredits.find((m) => m.month === month)?.total ?? 0),
    utilizado: Number(monthlyDebits.find((m) => m.month === month)?.total ?? 0),
  }));

  return (
    <div>
      <PageHeader
        title="Painel"
        description="Indicadores do programa de relacionamento da clínica."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pacientes ativos" value={String(activePatients)} />
        <StatCard label="Novos (30 dias)" value={String(newPatients)} />
        <StatCard
          label="Cashback gerado"
          value={formatBRL(creditAgg._sum.amount ?? 0)}
        />
        <StatCard
          label="Cashback utilizado"
          value={formatBRL(debitAgg._sum.amount ?? 0)}
        />
        <StatCard
          label="Cashback expirado"
          value={formatBRL(expiredAgg._sum.amount ?? 0)}
        />
        <StatCard
          label="Saldo promocional"
          value={formatBRL(walletAgg._sum.availableBalance ?? 0)}
        />
        <StatCard
          label="Pontos emitidos"
          value={String(pointsAgg._sum.pointsBalance ?? 0)}
        />
        <StatCard
          label="Taxa de resgate"
          value={`${
            Number(creditAgg._sum.amount ?? 0) === 0
              ? 0
              : Math.round(
                  (Number(debitAgg._sum.amount ?? 0) /
                    Number(creditAgg._sum.amount ?? 1)) *
                    100,
                )
          }%`}
        />
      </div>

      {advanced && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="LTV estimado" value={formatBRL(advanced.ltvEstimate)} />
          <StatCard label="Frequência média" value={advanced.avgFrequency} />
          <StatCard
            label="Intervalo médio (dias)"
            value={String(advanced.avgIntervalDays ?? "—")}
          />
          <StatCard label="Recorrentes" value={String(advanced.recurring)} />
          <StatCard label="1ª compra" value={String(advanced.firstTimers)} />
          <StatCard label="Ociosos" value={String(advanced.idle)} />
          <StatCard label="Taxa recuperação" value={`${advanced.recoveryRate}%`} />
          <StatCard label="Conv. indicação" value={`${advanced.referralConversion}%`} />
          <StatCard label="NPS" value={advanced.nps == null ? "—" : String(advanced.nps)} />
          <StatCard label="Saldo médio" value={formatBRL(advanced.avgBalance)} />
          <StatCard label="Vence em 7 dias" value={formatBRL(advanced.balanceExpiring7)} />
          <StatCard label="Vence em 30 dias" value={formatBRL(advanced.balanceExpiring30)} />
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-2xl text-slate-900">Cashback mensal</h2>
          <DashboardCharts kind="cashback" data={cashbackSeries} />
        </Card>
        <Card>
          <h2 className="text-2xl text-slate-900">Pacientes por categoria</h2>
          <DashboardCharts kind="categories" data={patientsByCategory} />
        </Card>
      </div>

      {advanced && advanced.topRewards.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-xl text-slate-900">Recompensas mais resgatadas</h2>
          <ul className="space-y-2 text-sm">
            {advanced.topRewards.map((r) => (
              <li key={r.rewardId} className="flex justify-between">
                <span>{r.name}</span>
                <span className="tabular">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
