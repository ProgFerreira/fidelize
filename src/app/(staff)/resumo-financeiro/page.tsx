import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Ban,
  CalendarDays,
  CircleDollarSign,
  ArrowDownCircle,
  Users,
  Calendar,
  Trophy,
  Percent,
  Wallet,
  Search,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatBRL } from "@/lib/money";
import { getFinancialSummary } from "@/lib/finance/summary";
import { getCashbackLiability } from "@/lib/finance/liability";
import {
  ResumoChannelChart,
  ResumoDailyChart,
} from "@/components/finance/resumo-charts";

function formatPct(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function HighlightIcon({
  icon,
}: {
  icon: "calendar" | "trophy" | "percent" | "wallet" | "search";
}) {
  const map = {
    calendar: Calendar,
    trophy: Trophy,
    percent: Percent,
    wallet: Wallet,
    search: Search,
  };
  const Icon = map[icon];
  return <Icon className="rf-highlight__glyph" aria-hidden />;
}

export default async function ResumoFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const { mes } = await searchParams;
  const [data, liability] = await Promise.all([
    getFinancialSummary(session.clinicId, mes),
    getCashbackLiability(session.clinicId),
  ]);

  const prev = new Date(data.period.start);
  prev.setMonth(prev.getMonth() - 1);
  const next = new Date(data.period.start);
  next.setMonth(next.getMonth() + 1);
  const prevMes = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const nextMes = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  const now = new Date();
  const canGoNext =
    next.getFullYear() < now.getFullYear() ||
    (next.getFullYear() === now.getFullYear() &&
      next.getMonth() <= now.getMonth());

  const circumference = 2 * Math.PI * 36;
  const progress = Math.min(Math.max(data.liquidoPct, 0), 100);
  const dash = (progress / 100) * circumference;

  return (
    <div className="rf-page">
      <header className="rf-header">
        <div className="rf-header__brand">
          <div className="rf-header__brand-icon">
            <TrendingUp aria-hidden />
          </div>
          <div>
            <h1 className="rf-header__title">Resumo financeiro</h1>
            <p className="rf-header__subtitle">{data.period.label}</p>
          </div>
        </div>

        <div className="rf-header__stats">
          <div className="rf-header__stat">
            <ShoppingBag className="rf-header__stat-icon" aria-hidden />
            <span>
              <strong>{data.registros}</strong> registros no período
            </span>
          </div>
          <div className="rf-header__stat">
            <CheckCircle2
              className="rf-header__stat-icon rf-header__stat-icon--ok"
              aria-hidden
            />
            <span>
              <strong>{data.comRecebimento}</strong> transações com recebimento
            </span>
          </div>
          <div className="rf-header__stat">
            <Ban
              className="rf-header__stat-icon rf-header__stat-icon--warn"
              aria-hidden
            />
            <span>
              <strong>{data.zerados}</strong> registros zerados
            </span>
          </div>
        </div>

        <div className="rf-header__period">
          <div className="rf-header__period-label">
            <CalendarDays aria-hidden />
            <span>Período</span>
          </div>
          <p className="rf-header__period-range">{data.period.rangeLabel}</p>
          <div className="rf-header__period-nav">
            <Link
              href={`/resumo-financeiro?mes=${prevMes}`}
              className="rf-header__nav-btn"
            >
              ← Anterior
            </Link>
            {canGoNext ? (
              <Link
                href={`/resumo-financeiro?mes=${nextMes}`}
                className="rf-header__nav-btn"
              >
                Próximo →
              </Link>
            ) : (
              <span className="rf-header__nav-btn rf-header__nav-btn--disabled">
                Próximo →
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="rf-kpis" aria-label="Indicadores financeiros">
        <article className="rf-kpi">
          <div className="rf-kpi__icon rf-kpi__icon--blue">
            <CircleDollarSign aria-hidden />
          </div>
          <div>
            <p className="rf-kpi__label">Faturamento bruto</p>
            <p className="rf-kpi__value">{formatBRL(data.bruto)}</p>
            <p className="rf-kpi__hint">100% do total</p>
          </div>
        </article>
        <article className="rf-kpi">
          <div className="rf-kpi__icon rf-kpi__icon--green">
            <CircleDollarSign aria-hidden />
          </div>
          <div>
            <p className="rf-kpi__label">Valor líquido recebido</p>
            <p className="rf-kpi__value">{formatBRL(data.liquido)}</p>
            <p className="rf-kpi__hint">{formatPct(data.liquidoPct)} do bruto</p>
          </div>
        </article>
        <article className="rf-kpi">
          <div className="rf-kpi__icon rf-kpi__icon--orange">
            <ArrowDownCircle aria-hidden />
          </div>
          <div>
            <p className="rf-kpi__label">Custos totais</p>
            <p className="rf-kpi__value">{formatBRL(data.custos)}</p>
            <p className="rf-kpi__hint">
              {formatPct(data.custosPct)} do bruto · descontos + benefícios
            </p>
          </div>
        </article>
        <article className="rf-kpi">
          <div className="rf-kpi__icon rf-kpi__icon--purple">
            <Users aria-hidden />
          </div>
          <div>
            <p className="rf-kpi__label">Ticket médio (bruto)</p>
            <p className="rf-kpi__value">{formatBRL(data.ticketMedio)}</p>
            <p className="rf-kpi__hint">por transação com recebimento</p>
          </div>
        </article>
      </section>

      <section className="rf-grid">
        <article className="rf-card">
          <h2 className="rf-card__title">Faturamento por canal</h2>
          <ResumoChannelChart channels={data.channels} />
          {data.channels.length > 0 && (
            <div className="rf-callout rf-callout--blue">
              <Activity aria-hidden />
              <p>{data.channelInsight}</p>
            </div>
          )}
        </article>

        <article className="rf-card">
          <h2 className="rf-card__title">Faturamento diário</h2>
          <ResumoDailyChart daily={data.daily} />
          <div className="rf-callout rf-callout--orange">
            <AlertTriangle aria-hidden />
            <p>
              Cashback gerado no período: {formatBRL(data.cashback)}. Acompanhe o
              percentual diário para equilibrar margem e fidelidade.
            </p>
          </div>
        </article>

        <article className="rf-card">
          <h2 className="rf-card__title">Destaques do período</h2>
          {data.highlights.length === 0 ? (
            <p className="rf-chart-empty">Nenhum destaque para o período.</p>
          ) : (
            <ul className="rf-highlights">
              {data.highlights.map((h) => (
                <li
                  key={h.id}
                  className={`rf-highlight rf-highlight--${h.tone}${
                    h.emphasize ? " rf-highlight--emphasis" : ""
                  }`}
                >
                  <div className="rf-highlight__icon">
                    <HighlightIcon icon={h.icon} />
                  </div>
                  <div>
                    <p className="rf-highlight__title">{h.title}</p>
                    <p className="rf-highlight__detail">{h.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rf-grid mt-6">
        <article className="rf-card">
          <h2 className="rf-card__title">Passivo de cashback</h2>
          <ul className="rf-highlights">
            <li className="rf-highlight">
              <div>
                <p className="rf-highlight__title">Provisionado</p>
                <p className="rf-highlight__detail">
                  {liability.provisioned} (disponível {liability.available} +
                  a liberar {liability.pending})
                </p>
              </div>
            </li>
            <li className="rf-highlight">
              <div>
                <p className="rf-highlight__title">Vence em 30 dias</p>
                <p className="rf-highlight__detail">{liability.expiring30}</p>
              </div>
            </li>
            <li className="rf-highlight">
              <div>
                <p className="rf-highlight__title">Movimento do mês</p>
                <p className="rf-highlight__detail">
                  Emitido {liability.issuedMonth} · resgatado{" "}
                  {liability.redeemedMonth} · expirado {liability.expiredMonth}
                </p>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <footer className="rf-footer">
        <div className="rf-footer__left">
          <div className="rf-footer__icon">
            <CircleDollarSign aria-hidden />
          </div>
          <p>
            Margem cedida em descontos e benefícios (bruto − líquido recebido)
          </p>
        </div>
        <div className="rf-footer__center">
          <p className="rf-footer__value">{formatBRL(data.custos)}</p>
          <p className="rf-footer__hint">
            Valor que deixou de entrar no caixa por descontos comerciais e
            resgate de benefícios. Cashback gerado: {formatBRL(data.cashback)}.
          </p>
        </div>
        <div className="rf-footer__right">
          <div
            className="rf-gauge"
            aria-label={`${formatPct(data.liquidoPct)} líquido`}
          >
            <svg viewBox="0 0 88 88" className="rf-gauge__svg">
              <circle className="rf-gauge__track" cx="44" cy="44" r="36" />
              <circle
                className="rf-gauge__progress"
                cx="44"
                cy="44"
                r="36"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <span className="rf-gauge__value">{formatPct(data.liquidoPct)}</span>
          </div>
          <p className="rf-footer__gauge-label">
            <strong>Percentual líquido recebido</strong> do valor bruto vendido.
          </p>
        </div>
      </footer>
    </div>
  );
}
