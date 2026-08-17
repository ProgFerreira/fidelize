import Link from "next/link";
import {
  Users,
  Wallet,
  TrendingUp,
  Percent,
  ScanLine,
  UserPlus,
  CalendarDays,
  Gift,
  ChevronRight,
  Building2,
  CalendarClock,
  UserRoundSearch,
  Hourglass,
  Timer,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatBRL } from "@/lib/money";
import { DashboardCharts } from "@/components/dashboard/charts";
import { CardKpi } from "@/components/ui";
import { advancedDashboardMetrics } from "@/lib/metrics";
import { CREDIT_LEDGER_TYPES } from "@/lib/ledger";
import { Prisma } from "@/generated/prisma/client";

function firstName(fullName: string | null | undefined) {
  const part = fullName?.trim().split(/\s+/)[0];
  return part || "bem-vindo";
}

function greetingForHour(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatTodayPt(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default async function DashboardPage() {
  const session = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const clinicId = session.clinicId;
  const permissions = session.user.permissions;

  const [
    clinic,
    activePatients,
    newPatients,
    creditAgg,
    debitAgg,
    walletAgg,
    categoryGroups,
    monthlyCredits,
    monthlyDebits,
    advanced,
  ] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, tradeName: true },
    }),
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
    prisma.wallet.aggregate({
      where: { clinicId, status: "ACTIVE" },
      _sum: { availableBalance: true },
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
    name: g.categoryId
      ? (categoryMap[g.categoryId] ?? "Sem categoria")
      : "Sem categoria",
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

  const creditTotal = Number(creditAgg._sum.amount ?? 0);
  const debitTotal = Number(debitAgg._sum.amount ?? 0);
  const redemptionRate =
    creditTotal === 0 ? 0 : Math.round((debitTotal / creditTotal) * 100);

  const clinicLabel = clinic?.tradeName || clinic?.name || "sua clínica";
  const canReception = hasPermission(permissions, PERMISSIONS.RECEPTION_OPERATE);
  const canPatients = hasPermission(permissions, PERMISSIONS.PATIENTS_READ);
  const canPatientsWrite = hasPermission(
    permissions,
    PERMISSIONS.PATIENTS_WRITE,
  );
  const canAgenda = hasPermission(permissions, PERMISSIONS.AGENDA_MANAGE);
  const canRewards = hasPermission(permissions, PERMISSIONS.REWARDS_MANAGE);
  const canRecovery = hasPermission(permissions, PERMISSIONS.RECOVERY_MANAGE);

  const idleCount = advanced?.idle ?? 0;
  const balanceExpiring7 = advanced?.balanceExpiring7 ?? "0";
  const balanceExpiring30 = advanced?.balanceExpiring30 ?? "0";

  const shortcuts = [
    canReception && {
      href: "/recepcao",
      label: "Recepção",
      desc: "Atender e lançar benefícios",
      icon: ScanLine,
    },
    canPatients && {
      href: "/pacientes",
      label: "Pacientes",
      desc: "Base do programa de fidelidade",
      icon: Users,
    },
    canAgenda && {
      href: "/agenda",
      label: "Agenda",
      desc: "Compromissos da clínica",
      icon: CalendarDays,
    },
    canRewards && {
      href: "/recompensas",
      label: "Recompensas",
      desc: "Catálogo de benefícios",
      icon: Gift,
    },
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    desc: string;
    icon: typeof ScanLine;
  }>;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero__inner">
          <div>
            <p className="dashboard-hero__eyebrow">Início · Fidelize</p>
            <h1 className="dashboard-hero__title">
              {greetingForHour()},{" "}
              <span>{firstName(session.user.name)}</span>
            </h1>
            <p className="dashboard-hero__desc">
              Visão geral do programa de relacionamento de{" "}
              <strong>{clinicLabel}</strong>. Acompanhe engajamento, cashback e
              oportunidades do dia.
            </p>
            <div className="dashboard-hero__meta">
              <span className="dashboard-hero__meta-item">
                <Building2 aria-hidden />
                {clinicLabel}
              </span>
              <span className="dashboard-hero__meta-item">
                <CalendarClock aria-hidden />
                {formatTodayPt()}
              </span>
            </div>
          </div>

          <div className="dashboard-hero__actions">
            {canReception && (
              <Link
                href="/recepcao"
                className="dashboard-hero__cta dashboard-hero__cta--primary"
              >
                <ScanLine aria-hidden />
                Ir para recepção
              </Link>
            )}
            {canPatientsWrite ? (
              <Link
                href="/pacientes/novo"
                className="dashboard-hero__cta dashboard-hero__cta--ghost"
              >
                <UserPlus aria-hidden />
                Novo paciente
              </Link>
            ) : canPatients ? (
              <Link
                href="/pacientes"
                className="dashboard-hero__cta dashboard-hero__cta--ghost"
              >
                <Users aria-hidden />
                Ver pacientes
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Indicadores principais"
      >
        <CardKpi
          titulo="Pacientes ativos"
          valor={String(activePatients)}
          detalhe={`${newPatients} novos nos últimos 30 dias`}
          icone={Users}
          cor="azul"
        />
        <CardKpi
          titulo="Saldo em carteira"
          valor={formatBRL(walletAgg._sum.availableBalance ?? 0)}
          detalhe="Disponível para resgate"
          icone={Wallet}
          cor="marca"
        />
        <CardKpi
          titulo="Cashback gerado"
          valor={formatBRL(creditTotal)}
          detalhe={`Utilizado: ${formatBRL(debitTotal)}`}
          icone={TrendingUp}
          cor="verde"
        />
        <CardKpi
          titulo="Taxa de resgate"
          valor={`${redemptionRate}%`}
          detalhe="Do cashback emitido"
          icone={Percent}
          cor="roxo"
        />
      </section>

      <section className="dashboard-attention" aria-label="Atenção do dia">
        <article className="dashboard-attention__card dashboard-attention__card--warn">
          <div className="dashboard-attention__top">
            <span className="dashboard-attention__icon">
              <UserRoundSearch className="h-4 w-4" aria-hidden />
            </span>
            <p className="dashboard-attention__label">Ociosos</p>
          </div>
          <p className="dashboard-attention__value">{idleCount}</p>
          <p className="dashboard-attention__hint">
            Pacientes sem visita há mais de 60 dias — oportunidade de
            reativação.
          </p>
          {canRecovery ? (
            <Link href="/recuperacao" className="dashboard-attention__link">
              Abrir recuperação
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : canPatients ? (
            <Link href="/pacientes" className="dashboard-attention__link">
              Ver pacientes
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </article>

        <article className="dashboard-attention__card dashboard-attention__card--alert">
          <div className="dashboard-attention__top">
            <span className="dashboard-attention__icon">
              <Hourglass className="h-4 w-4" aria-hidden />
            </span>
            <p className="dashboard-attention__label">Vence em 7 dias</p>
          </div>
          <p className="dashboard-attention__value">
            {formatBRL(balanceExpiring7)}
          </p>
          <p className="dashboard-attention__hint">
            Cashback prestes a expirar — incentive o resgate esta semana.
          </p>
          {canReception && (
            <Link href="/recepcao" className="dashboard-attention__link">
              Ir para recepção
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </article>

        <article className="dashboard-attention__card dashboard-attention__card--info">
          <div className="dashboard-attention__top">
            <span className="dashboard-attention__icon">
              <Timer className="h-4 w-4" aria-hidden />
            </span>
            <p className="dashboard-attention__label">Vence em 30 dias</p>
          </div>
          <p className="dashboard-attention__value">
            {formatBRL(balanceExpiring30)}
          </p>
          <p className="dashboard-attention__hint">
            Saldo promocional com vencimento no mês — planeje campanhas de uso.
          </p>
          {canRewards && (
            <Link href="/recompensas" className="dashboard-attention__link">
              Ver recompensas
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </article>
      </section>

      {shortcuts.length > 0 && (
        <section className="dashboard-shortcuts" aria-label="Atalhos">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="dashboard-shortcut"
              >
                <span className="dashboard-shortcut__icon">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="dashboard-shortcut__label">{item.label}</span>
                  <span className="dashboard-shortcut__desc">{item.desc}</span>
                </span>
                <ChevronRight
                  className="dashboard-shortcut__chevron h-4 w-4"
                  aria-hidden
                />
              </Link>
            );
          })}
        </section>
      )}

      <section className="dashboard-layout">
        <div className="dashboard-panel">
          <div className="dashboard-panel__head">
            <div>
              <h2 className="dashboard-panel__title">Cashback mensal</h2>
              <p className="dashboard-panel__desc">
                Evolução do valor gerado e utilizado no programa.
              </p>
            </div>
            <div className="dashboard-panel__legend">
              <span className="dashboard-panel__legend-item">
                <span className="dashboard-panel__dot dashboard-panel__dot--navy" />
                Gerado
              </span>
              <span className="dashboard-panel__legend-item">
                <span className="dashboard-panel__dot dashboard-panel__dot--gold" />
                Utilizado
              </span>
            </div>
          </div>
          <DashboardCharts kind="cashback" data={cashbackSeries} />
        </div>

        <aside className="dashboard-panel">
          <div className="dashboard-panel__head">
            <div>
              <h2 className="dashboard-panel__title">Decisão rápida</h2>
              <p className="dashboard-panel__desc">Últimos 30 dias</p>
            </div>
          </div>
          <div className="dashboard-insights">
            <div className="dashboard-insight">
              <span className="dashboard-insight__label">Frequência média</span>
              <span className="dashboard-insight__value">
                {advanced?.avgFrequency ?? "—"}
              </span>
            </div>
            <div className="dashboard-insight">
              <span className="dashboard-insight__label">LTV estimado</span>
              <span className="dashboard-insight__value">
                {advanced ? formatBRL(advanced.ltvEstimate) : "—"}
              </span>
            </div>
            <div className="dashboard-insight">
              <span className="dashboard-insight__label">NPS</span>
              <span className="dashboard-insight__value">
                {advanced?.nps == null ? "—" : advanced.nps}
              </span>
            </div>
            <div className="dashboard-insight">
              <span className="dashboard-insight__label">Recorrentes</span>
              <span className="dashboard-insight__value">
                {advanced?.recurring ?? "—"}
              </span>
            </div>
            <div className="dashboard-insight">
              <span className="dashboard-insight__label">Taxa recuperação</span>
              <span className="dashboard-insight__value">
                {advanced ? `${advanced.recoveryRate}%` : "—"}
              </span>
            </div>
            <div className="dashboard-insight">
              <span className="dashboard-insight__label">Conv. indicação</span>
              <span className="dashboard-insight__value">
                {advanced ? `${advanced.referralConversion}%` : "—"}
              </span>
            </div>
          </div>
        </aside>
      </section>

      <section className="dashboard-bottom">
        <div className="dashboard-panel">
          <div className="dashboard-panel__head">
            <div>
              <h2 className="dashboard-panel__title">
                Pacientes por categoria
              </h2>
              <p className="dashboard-panel__desc">
                Distribuição da base ativa no clube.
              </p>
            </div>
          </div>
          {patientsByCategory.length > 0 ? (
            <DashboardCharts kind="categories" data={patientsByCategory} />
          ) : (
            <p className="dashboard-empty">Ainda sem categorias preenchidas.</p>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel__head">
            <div>
              <h2 className="dashboard-panel__title">
                Recompensas mais resgatadas
              </h2>
              <p className="dashboard-panel__desc">
                Preferências recentes dos pacientes.
              </p>
            </div>
          </div>
          {advanced && advanced.topRewards.length > 0 ? (
            <ol className="dashboard-reward-list">
              {advanced.topRewards.slice(0, 6).map((r, index) => (
                <li key={r.rewardId} className="dashboard-reward">
                  <span className="dashboard-reward__rank">{index + 1}</span>
                  <span className="dashboard-reward__name">{r.name}</span>
                  <span className="dashboard-reward__count">{r.count}×</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dashboard-empty">
              Sem resgates suficientes para ranquear.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
