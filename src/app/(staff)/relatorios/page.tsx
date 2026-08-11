import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Scale,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import {
  LedgerStatus,
  LedgerType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  Select,
  Paginacao,
} from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { writeAuditLog } from "@/lib/audit";
import { reverseEntryAction } from "@/app/actions";
import { labelPt } from "@/lib/i18n/labels";
import { campaignRoi } from "@/lib/metrics";
import { CREDIT_LEDGER_TYPES } from "@/lib/ledger";

const PAGE_SIZE = 40;
const LEDGER_TYPES = Object.values(LedgerType);
const LEDGER_STATUSES = Object.values(LedgerStatus);
const CREDIT_TYPES_FOR_KPI = [
  ...CREDIT_LEDGER_TYPES,
  LedgerType.REVERSAL_REDEMPTION,
  LedgerType.GIFT_CARD_ISSUE,
  LedgerType.VOUCHER_ISSUE,
] as const;
const DEBIT_TYPES_FOR_KPI = [
  LedgerType.DEBIT_REDEMPTION,
  LedgerType.DEBIT_EXPIRATION,
  LedgerType.DEBIT_REWARD,
  LedgerType.DEBIT_VOUCHER,
  LedgerType.REVERSAL_CREDIT,
  LedgerType.GIFT_CARD_REDEEM,
] as const;

function parsePage(value?: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseLedgerType(value?: string): LedgerType | undefined {
  if (!value) return undefined;
  return LEDGER_TYPES.includes(value as LedgerType)
    ? (value as LedgerType)
    : undefined;
}

function parseLedgerStatus(value?: string): LedgerStatus | undefined {
  if (!value) return undefined;
  return LEDGER_STATUSES.includes(value as LedgerStatus)
    ? (value as LedgerStatus)
    : undefined;
}

function parseDateStart(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseDateEnd(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isCreditMovement(type: string) {
  return (
    type.startsWith("CREDIT_") ||
    type === "REVERSAL_REDEMPTION" ||
    type === "GIFT_CARD_ISSUE" ||
    type === "VOUCHER_ISSUE"
  );
}

function isDebitMovement(type: string) {
  return (
    type.startsWith("DEBIT_") ||
    type === "REVERSAL_CREDIT" ||
    type === "GIFT_CARD_REDEEM"
  );
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "success";
  if (status === "PENDING") return "gold";
  if (status === "REVERSED" || status === "CANCELLED") return "danger";
  return "muted";
}

function buildExportHref(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  q.set("type", "export");
  for (const [key, value] of Object.entries(params)) {
    if (value) q.set(key, value);
  }
  return `/relatorios?${q.toString()}`;
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    q?: string;
    tipo?: string;
    status?: string;
    de?: string;
    ate?: string;
    pagina?: string;
  }>;
}) {
  const session = await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const clinicId = session.clinicId;
  const {
    type = "ledger",
    q,
    tipo: tipoParam,
    status: statusParam,
    de: deParam,
    ate: ateParam,
    pagina: paginaParam,
  } = await searchParams;

  const tipo = parseLedgerType(tipoParam);
  const status = parseLedgerStatus(statusParam);
  const de = parseDateStart(deParam);
  const ate = parseDateEnd(ateParam);
  const paginaSolicitada = parsePage(paginaParam);
  const hasLedgerFilters = Boolean(q || tipo || status || deParam || ateParam);
  const isLedgerView = type === "ledger" || !type || type === "export";

  const ledgerWhere: Prisma.LedgerEntryWhereInput = {
    clinicId,
    ...(tipo ? { type: tipo } : {}),
    ...(status ? { status } : {}),
    ...(de || ate
      ? {
          createdAt: {
            ...(de ? { gte: de } : {}),
            ...(ate ? { lte: ate } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          wallet: {
            patient: {
              fullName: { contains: q },
            },
          },
        }
      : {}),
  };

  const creditWhere: Prisma.LedgerEntryWhereInput =
    !tipo || isCreditMovement(tipo)
      ? {
          ...ledgerWhere,
          type: tipo ?? { in: [...CREDIT_TYPES_FOR_KPI] },
          status: status ?? { in: ["COMPLETED", "PENDING"] },
        }
      : { clinicId, id: { in: [] } };
  const debitWhere: Prisma.LedgerEntryWhereInput =
    !tipo || isDebitMovement(tipo)
      ? {
          ...ledgerWhere,
          type: tipo ?? { in: [...DEBIT_TYPES_FOR_KPI] },
          status: status ?? "COMPLETED",
        }
      : { clinicId, id: { in: [] } };

  const filteredTotal = isLedgerView
    ? await prisma.ledgerEntry.count({ where: ledgerWhere })
    : 0;
  const totalPaginas = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
  const rangeStart =
    filteredTotal === 0 ? 0 : (paginaAtual - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(paginaAtual * PAGE_SIZE, filteredTotal);

  const [
    blockedWalletsCount,
    creditAgg,
    debitAgg,
    ledgerPage,
    campaigns,
    patients,
    exportRows,
  ] = await Promise.all([
    prisma.wallet.count({ where: { clinicId, status: "BLOCKED" } }),
    isLedgerView
      ? prisma.ledgerEntry.aggregate({
          where: creditWhere,
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    isLedgerView
      ? prisma.ledgerEntry.aggregate({
          where: debitWhere,
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    isLedgerView && type !== "export"
      ? prisma.ledgerEntry.findMany({
          where: ledgerWhere,
          orderBy: { createdAt: "desc" },
          skip: (paginaAtual - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          include: {
            wallet: { include: { patient: true } },
            campaign: { select: { name: true } },
            operator: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    type === "roi"
      ? prisma.campaign.findMany({ where: { clinicId } })
      : Promise.resolve([]),
    type === "patients"
      ? prisma.patient.findMany({
          where: { clinicId },
          include: { wallets: { include: { category: true } } },
          take: 100,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    type === "export"
      ? prisma.ledgerEntry.findMany({
          where: ledgerWhere,
          orderBy: { createdAt: "desc" },
          take: 5000,
          include: { wallet: { include: { patient: true } } },
        })
      : Promise.resolve([]),
  ]);

  const roiRows =
    type === "roi"
      ? await Promise.all(
          campaigns.map(async (c) => ({
            campaign: c,
            roi: await campaignRoi(clinicId, c.id),
          })),
        )
      : [];

  if (type === "export") {
    await writeAuditLog({
      clinicId,
      userId: session.user.id,
      action: "REPORT_EXPORT",
      metadata: {
        format: "csv",
        report: "ledger",
        filters: {
          q: q || null,
          tipo: tipo || null,
          status: status || null,
          de: deParam || null,
          ate: ateParam || null,
        },
      },
    });
  }

  const csv =
    "id,tipo,valor,paciente,status,data\n" +
    exportRows
      .map(
        (e) =>
          `${e.id},${labelPt(e.type)},${e.amount},${e.wallet.patient.fullName},${labelPt(e.status)},${e.createdAt.toISOString()}`,
      )
      .join("\n");

  const creditTotal = Number(creditAgg._sum.amount ?? 0);
  const debitTotal = Number(debitAgg._sum.amount ?? 0);
  const netTotal = creditTotal - debitTotal;
  const canReverse = session.user.permissions.includes(
    PERMISSIONS.FINANCE_REVERSAL,
  );

  const tabClass = (tab: string) =>
    type === tab || (!type && tab === "ledger")
      ? "relatorios-tabs__btn relatorios-tabs__btn--active"
      : "relatorios-tabs__btn";

  return (
    <div className="relatorios-page">
      <PageHeader
        title="Relatórios"
        description="Movimentações, pacientes, ROI de campanhas e passivo promocional."
        actions={
          <div className="relatorios-tabs">
            <Link href="/relatorios?type=ledger" className={tabClass("ledger")}>
              Extrato
            </Link>
            <Link
              href="/relatorios?type=patients"
              className={tabClass("patients")}
            >
              Pacientes
            </Link>
            <Link href="/relatorios?type=roi" className={tabClass("roi")}>
              ROI campanhas
            </Link>
            <Link
              href={buildExportHref({
                q,
                tipo,
                status,
                de: deParam,
                ate: ateParam,
              })}
            >
              <Button variant="gold">Exportar CSV</Button>
            </Link>
          </div>
        }
      />

      {type === "export" ? (
        <Card className="mb-4">
          <h2 className="text-xl">CSV gerado</h2>
          <p className="mt-1 text-sm text-slate-500">
            {exportRows.length} registro(s)
            {hasLedgerFilters ? " com os filtros aplicados" : ""}.
          </p>
          <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-100 p-3 text-xs">
            {csv}
          </pre>
        </Card>
      ) : null}

      {type === "roi" ? (
        <div className="space-y-3">
          {roiRows.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">
                Nenhuma campanha cadastrada.
              </p>
            </Card>
          ) : (
            roiRows.map(({ campaign, roi }) => (
              <Card key={campaign.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{campaign.name}</p>
                    <p className="text-sm text-slate-500">
                      {labelPt(campaign.status)} · {roi.attributedVisits} visitas
                      atribuídas · {roi.impacted} impactos
                    </p>
                  </div>
                  <Badge
                    tone={roi.roi != null && roi.roi >= 0 ? "success" : "gold"}
                  >
                    ROI {roi.roi == null ? "—" : `${roi.roi}%`}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-400">Receita</p>
                    <p className="font-semibold">{formatBRL(roi.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Custo benefício</p>
                    <p className="font-semibold">{formatBRL(roi.benefitCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Custo comunicação</p>
                    <p className="font-semibold">{formatBRL(roi.commCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Receita líquida</p>
                    <p className="font-semibold">{formatBRL(roi.netRevenue)}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {type === "patients" ? (
        <div className="space-y-3">
          {patients.map((p) => (
            <Card key={p.id}>
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.fullName}</p>
                  <p className="text-sm text-slate-500">{p.cpf}</p>
                </div>
                <Badge tone="gold">
                  {p.wallets[0]?.category?.name ?? "—"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {isLedgerView && type !== "export" ? (
        <>
          <div className="relatorios-stats">
            <div className="relatorios-stat">
              <div className="relatorios-stat__icon">
                <Wallet className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="relatorios-stat__label">Movimentos</p>
                <p className="relatorios-stat__value">{filteredTotal}</p>
              </div>
            </div>
            <div className="relatorios-stat">
              <div className="relatorios-stat__icon relatorios-stat__icon--green">
                <ArrowDownLeft className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="relatorios-stat__label">Créditos</p>
                <p className="relatorios-stat__value">
                  {formatBRL(creditTotal)}
                </p>
              </div>
            </div>
            <div className="relatorios-stat">
              <div className="relatorios-stat__icon relatorios-stat__icon--danger">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="relatorios-stat__label">Débitos</p>
                <p className="relatorios-stat__value">{formatBRL(debitTotal)}</p>
              </div>
            </div>
            <div className="relatorios-stat">
              <div className="relatorios-stat__icon relatorios-stat__icon--gold">
                <Scale className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="relatorios-stat__label">Líquido</p>
                <p className="relatorios-stat__value">{formatBRL(netTotal)}</p>
              </div>
            </div>
            <div className="relatorios-stat">
              <div className="relatorios-stat__icon relatorios-stat__icon--danger">
                <ShieldAlert className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <p className="relatorios-stat__label">Carteiras bloqueadas</p>
                <p className="relatorios-stat__value">{blockedWalletsCount}</p>
              </div>
            </div>
          </div>

          <div className="relatorios-search">
            <form className="relatorios-search__form">
              <input type="hidden" name="type" value="ledger" />
              <div className="relatorios-search__row">
                <div className="relatorios-search__field">
                  <Search aria-hidden />
                  <Input
                    name="q"
                    type="search"
                    defaultValue={q}
                    placeholder="Buscar por nome do paciente"
                    aria-label="Buscar lançamentos por paciente"
                  />
                </div>
                <Button type="submit">Filtrar</Button>
                {hasLedgerFilters ? (
                  <Link href="/relatorios?type=ledger">
                    <Button type="button" variant="contorno">
                      Limpar
                    </Button>
                  </Link>
                ) : null}
              </div>

              <div className="relatorios-search__filters">
                <div className="relatorios-search__filter">
                  <label htmlFor="filtro-tipo-ledger">Tipo</label>
                  <Select
                    id="filtro-tipo-ledger"
                    name="tipo"
                    defaultValue={tipo ?? ""}
                    aria-label="Filtrar por tipo"
                  >
                    <option value="">Todos</option>
                    {LEDGER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {labelPt(t)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="relatorios-search__filter">
                  <label htmlFor="filtro-status-ledger">Status</label>
                  <Select
                    id="filtro-status-ledger"
                    name="status"
                    defaultValue={status ?? ""}
                    aria-label="Filtrar por status"
                  >
                    <option value="">Todos</option>
                    {LEDGER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {labelPt(s)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="relatorios-search__filter">
                  <label htmlFor="filtro-de-ledger">De</label>
                  <Input
                    id="filtro-de-ledger"
                    name="de"
                    type="date"
                    defaultValue={deParam ?? ""}
                    aria-label="Data inicial"
                  />
                </div>
                <div className="relatorios-search__filter">
                  <label htmlFor="filtro-ate-ledger">Até</label>
                  <Input
                    id="filtro-ate-ledger"
                    name="ate"
                    type="date"
                    defaultValue={ateParam ?? ""}
                    aria-label="Data final"
                  />
                </div>
              </div>
            </form>
            <p className="relatorios-search__hint">
              <Filter className="relatorios-search__hint-icon" aria-hidden />
              Filtre por paciente, tipo, status e período. O CSV exportado
              respeita os mesmos filtros.
            </p>
          </div>

          {filteredTotal > 0 ? (
            <div className="relatorios-range" role="status">
              <p>
                Exibindo <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong>{" "}
                de <strong>{filteredTotal}</strong>
                {hasLedgerFilters
                  ? " resultado(s) filtrado(s)"
                  : " lançamento(s)"}
              </p>
              {totalPaginas > 1 ? (
                <p className="relatorios-range__pages">
                  Página {paginaAtual} de {totalPaginas}
                </p>
              ) : null}
            </div>
          ) : null}

          {ledgerPage.length === 0 ? (
            <div className="relatorios-empty">
              <div className="relatorios-empty__icon">
                <Wallet className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="relatorios-empty__title">
                {hasLedgerFilters
                  ? "Nenhum lançamento encontrado"
                  : "Ainda não há lançamentos"}
              </h3>
              <p className="relatorios-empty__desc">
                {hasLedgerFilters
                  ? "Ajuste os filtros ou limpe a busca para ver o extrato completo."
                  : "Os créditos e resgates do clube aparecerão aqui."}
              </p>
              {hasLedgerFilters ? (
                <div className="relatorios-empty__actions">
                  <Link href="/relatorios?type=ledger">
                    <Button variant="contorno">Ver todos</Button>
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="relatorios-list">
                {ledgerPage.map((entry) => {
                  const credit = isCreditMovement(entry.type);
                  const debit = isDebitMovement(entry.type);
                  const amountClass = credit
                    ? "relatorios-row__amount relatorios-row__amount--credit"
                    : debit
                      ? "relatorios-row__amount relatorios-row__amount--debit"
                      : "relatorios-row__amount";

                  return (
                    <article key={entry.id} className="relatorios-row">
                      <div className="relatorios-row__main">
                        <div
                          className={
                            credit
                              ? "relatorios-row__icon relatorios-row__icon--credit"
                              : debit
                                ? "relatorios-row__icon relatorios-row__icon--debit"
                                : "relatorios-row__icon"
                          }
                          aria-hidden
                        >
                          {credit ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="relatorios-row__title-line">
                            <p className="relatorios-row__title">
                              {labelPt(entry.type)}
                            </p>
                            <Badge tone={statusTone(entry.status)}>
                              {labelPt(entry.status)}
                            </Badge>
                          </div>
                          <div className="relatorios-row__meta">
                            <span>{entry.wallet.patient.fullName}</span>
                            <span>
                              {entry.createdAt.toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {entry.campaign?.name ? (
                              <span>{entry.campaign.name}</span>
                            ) : null}
                            {entry.operator?.name ? (
                              <span>Op. {entry.operator.name}</span>
                            ) : null}
                            {entry.origin ? <span>{entry.origin}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="relatorios-row__side">
                        <p className={amountClass}>
                          {credit ? "+" : debit ? "−" : ""}
                          {formatBRL(entry.amount)}
                        </p>
                        {entry.status === "COMPLETED" && canReverse ? (
                          <form
                            action={reverseEntryAction}
                            className="relatorios-row__reverse"
                          >
                            <input
                              type="hidden"
                              name="entryId"
                              value={entry.id}
                            />
                            <Input
                              name="reason"
                              placeholder="Motivo do estorno"
                              required
                              className="h-8 text-xs"
                              aria-label="Motivo do estorno"
                            />
                            <Button
                              type="submit"
                              variant="danger"
                              className="h-8 shrink-0 px-2.5 text-xs"
                            >
                              Estornar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              {totalPaginas > 1 ? (
                <Paginacao
                  pagina={paginaAtual}
                  totalPaginas={totalPaginas}
                  total={filteredTotal}
                  params={{
                    type: "ledger",
                    q: q || undefined,
                    tipo: tipo || undefined,
                    status: status || undefined,
                    de: deParam || undefined,
                    ate: ateParam || undefined,
                  }}
                  className="relatorios-pagination"
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
