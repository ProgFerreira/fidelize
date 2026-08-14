import Link from "next/link";
import {
  AlertTriangle,
  CreditCard,
  Filter,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  CabecalhoPagina,
  Button,
  classesBotao,
  Input,
  Select,
  Paginacao,
} from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";
import { getCardSettings, getStockAlerts } from "@/lib/cards";
import { toClientProps } from "@/lib/serialize";
import { CardsOpsPanel } from "@/components/cards/cards-ops-panel";
import { CardsList } from "@/components/cards/cards-list";

const PAGE_SIZE = 40;
const CARD_STATUSES = [
  "AVAILABLE",
  "ACTIVE",
  "BLOCKED",
  "REPLACED",
  "CANCELLED",
] as const;
type CardStatusFilter = (typeof CARD_STATUSES)[number];

function parseStatus(value?: string): CardStatusFilter | undefined {
  if (!value) return undefined;
  return CARD_STATUSES.includes(value as CardStatusFilter)
    ? (value as CardStatusFilter)
    : undefined;
}

function parsePage(value?: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function CartoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    unidade?: string;
    kind?: string;
    pagina?: string;
  }>;
}) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const clinicId = session.clinicId;
  const {
    q,
    status: statusParam,
    unidade,
    kind,
    pagina: paginaParam,
  } = await searchParams;

  const status = parseStatus(statusParam);
  const kindFilter =
    kind === "PHYSICAL" || kind === "VIRTUAL" ? kind : undefined;
  const paginaSolicitada = parsePage(paginaParam);
  const hasFilters = Boolean(q || status || unidade || kindFilter);

  const where: Prisma.CardWhereInput = {
    clinicId,
    ...(status ? { status } : {}),
    ...(unidade ? { unitId: unidade } : {}),
    ...(kindFilter ? { kind: kindFilter } : {}),
    ...(q
      ? {
          OR: [
            { cardNumber: { contains: q } },
            { publicToken: { contains: q } },
            { wallet: { patient: { fullName: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [
    units,
    settings,
    stock,
    totalCards,
    availableCount,
    activeCount,
    blockedCount,
    filteredTotal,
    availableCards,
  ] = await Promise.all([
    prisma.unit.findMany({
      where: { clinicId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCardSettings(clinicId),
    getStockAlerts(clinicId),
    prisma.card.count({ where: { clinicId } }),
    prisma.card.count({
      where: { clinicId, status: "AVAILABLE", kind: "PHYSICAL" },
    }),
    prisma.card.count({ where: { clinicId, status: "ACTIVE" } }),
    prisma.card.count({ where: { clinicId, status: "BLOCKED" } }),
    prisma.card.count({ where }),
    prisma.card.findMany({
      where: { clinicId, status: "AVAILABLE", kind: "PHYSICAL" },
      select: { id: true, cardNumber: true, publicToken: true },
      orderBy: { cardNumber: "asc" },
      take: 200,
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
  const rangeStart = filteredTotal === 0 ? 0 : (paginaAtual - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(paginaAtual * PAGE_SIZE, filteredTotal);
  const queryParams = {
    q: q || undefined,
    status: status || undefined,
    unidade: unidade || undefined,
    kind: kindFilter || undefined,
  };

  const cards = await prisma.card.findMany({
    where,
    include: {
      wallet: { include: { patient: { select: { id: true, fullName: true } } } },
      unit: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (paginaAtual - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const listItems = toClientProps<
    Array<{
      id: string;
      cardNumber: string;
      publicToken: string;
      kind: string;
      status: string;
      expiresAt: string | null;
      linkedAt: string | null;
      createdAt: string;
      blockedReason: string | null;
      unitName: string | null;
      patient: { id: string; fullName: string } | null;
    }>
  >(
    cards.map((card) => ({
      id: card.id,
      cardNumber: card.cardNumber,
      publicToken: card.publicToken,
      kind: card.kind,
      status: card.status,
      expiresAt: card.expiresAt,
      linkedAt: card.linkedAt,
      createdAt: card.createdAt,
      blockedReason: card.blockedReason,
      unitName: card.unit?.name ?? null,
      patient: card.wallet?.patient
        ? { id: card.wallet.patient.id, fullName: card.wallet.patient.fullName }
        : null,
    })),
  );

  return (
    <div className="cartoes-page">
      <CabecalhoPagina
        titulo="Cartões"
        descricao="Estoque físico, cartão virtual, vínculo, 2ª via, bloqueio e impressão de QR."
        acoes={
          <Link
            href="/cartoes/imprimir?status=AVAILABLE"
            className={classesBotao({ variante: "contorno" })}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir etiquetas
          </Link>
        }
      />

      {stock.alerts.length > 0 ? (
        <div className="cartoes-alert" role="status">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          <div>
            <p className="cartoes-alert__title">Estoque baixo</p>
            <p className="cartoes-alert__desc">
              {stock.alerts
                .map((a) => `${a.unitName}: ${a.available} disponível(is)`)
                .join(" · ")}{" "}
              (limite {settings.lowStockThreshold}).
            </p>
          </div>
        </div>
      ) : null}

      <div className="cartoes-stats cartoes-stats--4">
        <div className="cartoes-stat">
          <div className="cartoes-stat__icon">
            <WalletCards className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="cartoes-stat__label">Total</p>
            <p className="cartoes-stat__value">{totalCards}</p>
          </div>
        </div>
        <div className="cartoes-stat">
          <div className="cartoes-stat__icon cartoes-stat__icon--gold">
            <CreditCard className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="cartoes-stat__label">Disponíveis (físico)</p>
            <p className="cartoes-stat__value">{availableCount}</p>
          </div>
        </div>
        <div className="cartoes-stat">
          <div className="cartoes-stat__icon cartoes-stat__icon--green">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="cartoes-stat__label">Ativos</p>
            <p className="cartoes-stat__value">{activeCount}</p>
          </div>
        </div>
        <div className="cartoes-stat">
          <div className="cartoes-stat__icon cartoes-stat__icon--danger">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="cartoes-stat__label">Bloqueados</p>
            <p className="cartoes-stat__value">{blockedCount}</p>
          </div>
        </div>
      </div>

      <CardsOpsPanel
        units={units}
        settings={settings}
        availableCards={availableCards}
      />

      <div className="cartoes-search">
        <form className="cartoes-search__form">
          <div className="cartoes-search__row">
            <div className="cartoes-search__field">
              <Search aria-hidden />
              <Input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Buscar por número, token ou paciente"
                aria-label="Buscar cartões"
              />
            </div>
            <Button type="submit">Buscar</Button>
            {hasFilters ? (
              <Link href="/cartoes" className={classesBotao({ variante: "contorno" })}>
                Limpar
              </Link>
            ) : null}
          </div>

          <div className="cartoes-search__filters cartoes-search__filters--3">
            <div className="cartoes-search__filter">
              <label htmlFor="filtro-status-cartao">Status</label>
              <Select
                id="filtro-status-cartao"
                name="status"
                defaultValue={status ?? ""}
              >
                <option value="">Todos</option>
                {CARD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelPt(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="cartoes-search__filter">
              <label htmlFor="filtro-kind-cartao">Tipo</label>
              <Select
                id="filtro-kind-cartao"
                name="kind"
                defaultValue={kindFilter ?? ""}
              >
                <option value="">Todos</option>
                <option value="PHYSICAL">Físico</option>
                <option value="VIRTUAL">Virtual</option>
              </Select>
            </div>
            <div className="cartoes-search__filter">
              <label htmlFor="filtro-unidade-cartao">Unidade</label>
              <Select
                id="filtro-unidade-cartao"
                name="unidade"
                defaultValue={unidade ?? ""}
              >
                <option value="">Todas</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </form>
        <p className="cartoes-search__hint">
          <Filter className="cartoes-search__hint-icon" aria-hidden />
          Use 2ª via para substituir cartão perdido. Virtual e físico podem
          ficar ativos juntos no mesmo paciente.
        </p>
      </div>

      {filteredTotal > 0 ? (
        <div className="cartoes-range" role="status">
          <p>
            Exibindo <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{" "}
            <strong>{filteredTotal}</strong>
            {hasFilters ? " resultado(s)" : " cartão(ões)"}
          </p>
          {totalPaginas > 1 ? (
            <p className="cartoes-range__pages">
              Página {paginaAtual} de {totalPaginas}
            </p>
          ) : null}
        </div>
      ) : null}

      {cards.length === 0 ? (
        <div className="cartoes-empty">
          <div className="cartoes-empty__icon">
            <CreditCard className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="cartoes-empty__title">
            {hasFilters ? "Nenhum cartão encontrado" : "Ainda não há cartões"}
          </h3>
          <p className="cartoes-empty__desc">
            {hasFilters
              ? "Ajuste a busca ou os filtros."
              : "Gere o primeiro lote físico ou emita um cartão virtual."}
          </p>
        </div>
      ) : (
        <>
          <CardsList
            cards={listItems}
            availableOptions={availableCards}
          />
          <div className="cartoes-pagination">
            <Paginacao
              pagina={paginaAtual}
              totalPaginas={totalPaginas}
              total={filteredTotal}
              params={queryParams}
              className="flex w-full items-center justify-between gap-4"
            />
          </div>
        </>
      )}
    </div>
  );
}
