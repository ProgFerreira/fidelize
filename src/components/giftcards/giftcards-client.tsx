"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  Gift,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Campo,
  Card,
  Input,
  Textarea,
  toast,
} from "@/components/ui";
import {
  activateGiftCardAction,
  issueGiftCardAction,
  redeemGiftCardAction,
} from "@/app/v2-actions";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export type GiftCardDTO = {
  id: string;
  code: string;
  buyerName: string | null;
  beneficiaryName: string | null;
  message: string | null;
  initialAmount: string | number;
  remainingAmount: string | number;
  status: string;
  allowPartial: boolean;
  expiresAt: string | null;
  createdAt: string;
};

type Draft = {
  initialAmount: string;
  buyerName: string;
  beneficiaryName: string;
  message: string;
  expiresAt: string;
  activate: boolean;
  allowPartial: boolean;
};

type Props = {
  initialCards: GiftCardDTO[];
};

type StatusFilter = "all" | "active" | "inactive";

function emptyDraft(): Draft {
  return {
    initialAmount: "",
    buyerName: "",
    beneficiaryName: "",
    message: "",
    expiresAt: "",
    activate: true,
    allowPartial: true,
  };
}

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "Sem validade";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Sem validade";
  return `Validade ${date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function isUsableStatus(status: string) {
  return status === "ACTIVE" || status === "PARTIALLY_USED";
}

function statusTone(status: string): "success" | "gold" | "muted" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "PARTIALLY_USED") return "gold";
  if (status === "PENDING_PAYMENT") return "muted";
  if (status === "CANCELLED" || status === "EXPIRED") return "danger";
  return "muted";
}

function displayName(card: GiftCardDTO) {
  return (
    card.beneficiaryName?.trim() ||
    card.buyerName?.trim() ||
    "Vale-presente"
  );
}

function mergeCard(prev: GiftCardDTO[], next: GiftCardDTO) {
  const exists = prev.some((c) => c.id === next.id);
  if (exists) {
    return prev.map((c) => (c.id === next.id ? { ...c, ...next } : c));
  }
  return [next, ...prev];
}

export function GiftCardsClient({ initialCards }: Props) {
  const router = useRouter();
  const [cards, setCards] = React.useState(initialCards);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [viewing, setViewing] = React.useState<GiftCardDTO | null>(null);
  const [redeemOpen, setRedeemOpen] = React.useState(false);
  const [redeemCode, setRedeemCode] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [saving, setSaving] = React.useState(false);
  const [redeeming, setRedeeming] = React.useState(false);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const activeCount = cards.filter((c) => isUsableStatus(c.status)).length;
  const pendingCount = cards.filter(
    (c) => c.status === "PENDING_PAYMENT",
  ).length;
  const remainingTotal = cards.reduce(
    (acc, c) => acc + Number(c.remainingAmount || 0),
    0,
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (statusFilter === "active" && !isUsableStatus(c.status)) return false;
      if (statusFilter === "inactive" && isUsableStatus(c.status)) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        (c.buyerName ?? "").toLowerCase().includes(q) ||
        (c.beneficiaryName ?? "").toLowerCase().includes(q) ||
        (c.message ?? "").toLowerCase().includes(q) ||
        labelPt(c.status).toLowerCase().includes(q)
      );
    });
  }, [cards, query, statusFilter]);

  async function onIssue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    if (draft.activate) fd.set("activate", "on");
    else fd.delete("activate");
    if (draft.allowPartial) fd.set("allowPartial", "on");
    else fd.set("allowPartial", "off");
    try {
      const result = await issueGiftCardAction(fd);
      if (!result.ok) {
        toast.error("Falha ao emitir", result.error);
        return;
      }
      setCards((prev) => mergeCard(prev, result.giftCard as GiftCardDTO));
      toast.success("Vale emitido", result.giftCard.code);
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível emitir",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onRedeem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRedeeming(true);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await redeemGiftCardAction(fd);
      if (!result.ok) {
        toast.error("Falha ao debitar", result.error);
        return;
      }
      setCards((prev) => mergeCard(prev, result.giftCard as GiftCardDTO));
      toast.success("Valor debitado", result.giftCard.code);
      setRedeemOpen(false);
      setRedeemCode("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível debitar",
      );
    } finally {
      setRedeeming(false);
    }
  }

  async function onActivate(giftCardId: string) {
    setActivatingId(giftCardId);
    const fd = new FormData();
    fd.set("giftCardId", giftCardId);
    try {
      const result = await activateGiftCardAction(fd);
      if (!result.ok) {
        toast.error("Falha ao ativar", result.error);
        return;
      }
      setCards((prev) => mergeCard(prev, result.giftCard as GiftCardDTO));
      setViewing((prev) =>
        prev?.id === result.giftCard.id
          ? { ...prev, ...result.giftCard }
          : prev,
      );
      toast.success("Vale ativado", result.giftCard.code);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível ativar",
      );
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <>
      <div className="services-hero">
        <p className="services-hero__eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Pré-pago digital
        </p>
        <h2 className="services-hero__title">
          Vales-presente separados do saldo promocional
        </h2>
        <p className="services-hero__desc">
          Emita, ative e debite códigos com saldo restante — sem misturar com
          cashback ou pontos.
        </p>
      </div>

      <div className="services-stats">
        <div className="services-stat">
          <div className="services-stat__icon">
            <Gift className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Vales</p>
            <p className="services-stat__value">{cards.length}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--green">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Utilizáveis</p>
            <p className="services-stat__value">{activeCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--blue">
            <User className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Pendentes</p>
            <p className="services-stat__value">{pendingCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--gold">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Saldo em aberto</p>
            <p className="services-stat__value">{formatBRL(remainingTotal)}</p>
          </div>
        </div>
      </div>

      <div className="services-toolbar">
        <div className="services-toolbar__row">
          <div className="services-toolbar__search">
            <Search aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código, comprador ou beneficiário"
              aria-label="Buscar vales-presente"
            />
          </div>

          <div
            className="services-toolbar__filters"
            role="group"
            aria-label="Filtrar status"
          >
            {(
              [
                { id: "all", label: "Todos" },
                { id: "active", label: "Utilizáveis" },
                { id: "inactive", label: "Outros" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "services-filter",
                  statusFilter === f.id && "services-filter--active",
                )}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="services-toolbar__actions">
            <Button
              type="button"
              variant="contorno"
              onClick={() => {
                setRedeemCode("");
                setRedeemOpen(true);
              }}
            >
              <ScanLine className="h-4 w-4" aria-hidden />
              Debitar
            </Button>
            <Button
              type="button"
              variant="gold"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Emitir vale
            </Button>
          </div>
        </div>
        <p className="services-toolbar__hint">
          {filtered.length === cards.length
            ? `${cards.length} vale${cards.length === 1 ? "" : "s"}`
            : `Mostrando ${filtered.length} de ${cards.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="services-empty">
          <div className="services-empty__icon">
            <Gift className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="services-empty__title">
            {cards.length === 0
              ? "Nenhum vale-presente emitido"
              : "Nenhum resultado para esta busca"}
          </h3>
          <p className="services-empty__desc">
            {cards.length === 0
              ? "Emita o primeiro vale com valor, comprador e beneficiário — depois ative e debite pelo código."
              : "Tente outro termo ou limpe os filtros para ver todos os vales."}
          </p>
          <div className="services-empty__actions">
            {cards.length > 0 ? (
              <Button
                type="button"
                variant="contorno"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
            <Button
              type="button"
              variant="gold"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Emitir vale
            </Button>
          </div>
        </div>
      ) : (
        <div className="services-grid">
          {filtered.map((card) => (
            <article
              key={card.id}
              className={cn(
                "service-card",
                !isUsableStatus(card.status) && "service-card--inactive",
              )}
            >
              <div className="service-card__header">
                <div className="service-card__icon" aria-hidden>
                  <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="service-card__title">{displayName(card)}</h3>
                  <p className="service-card__code">{card.code}</p>
                  <div className="service-card__badges">
                    <Badge tone={statusTone(card.status)}>
                      {labelPt(card.status)}
                    </Badge>
                    {card.allowPartial ? (
                      <Badge tone="gold">Uso parcial</Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="service-card__hero">
                <p className="service-card__price">
                  {formatBRL(Number(card.remainingAmount))}
                </p>
                <p className="service-card__price-label">
                  restante de {formatBRL(Number(card.initialAmount))}
                </p>
              </div>

              <p className="service-card__desc">
                {card.message?.trim()
                  ? card.message
                  : card.buyerName
                    ? `Comprado por ${card.buyerName}`
                    : "Sem mensagem — adicione comprador, beneficiário ou mensagem ao emitir."}
              </p>

              <div className="service-card__meta">
                <span className="service-chip">
                  <User aria-hidden />
                  {card.buyerName?.trim() || "Comprador —"}
                </span>
                <span className="service-chip">
                  <Wallet aria-hidden />
                  {formatExpiry(card.expiresAt)}
                </span>
              </div>

              <div className="service-card__footer">
                <Button
                  type="button"
                  size="sm"
                  variant="contorno"
                  onClick={() => setViewing(card)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  Visualizar
                </Button>
                {card.status === "PENDING_PAYMENT" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={activatingId === card.id}
                    onClick={() => onActivate(card.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {activatingId === card.id ? "Ativando..." : "Ativar"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRedeemCode(card.code);
                      setRedeemOpen(true);
                    }}
                  >
                    <ScanLine className="h-3.5 w-3.5" aria-hidden />
                    Debitar
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {viewing ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => setViewing(null)}
          />
          <Card className="agenda__modal-card agenda__modal-card--tall max-w-xl">
            <div className="agenda__modal-head">
              <h2>Detalhes do vale</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setViewing(null)}
              >
                Fechar
              </Button>
            </div>

            <div className="service-view">
              <div className="service-view__title-row">
                <div className="min-w-0">
                  <h3 className="service-view__name">{displayName(viewing)}</h3>
                  <p className="service-view__code">{viewing.code}</p>
                </div>
                <div className="service-view__badges">
                  <Badge tone={statusTone(viewing.status)}>
                    {labelPt(viewing.status)}
                  </Badge>
                </div>
              </div>

              <p className="service-view__price">
                {formatBRL(Number(viewing.remainingAmount))}
              </p>
              <p className="service-view__price-label">
                restante de {formatBRL(Number(viewing.initialAmount))}
              </p>

              <p className="service-view__desc">
                {viewing.message?.trim()
                  ? viewing.message
                  : "Sem mensagem cadastrada."}
              </p>

              <dl className="service-view__grid">
                <div>
                  <dt>Comprador</dt>
                  <dd>{viewing.buyerName?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt>Beneficiário</dt>
                  <dd>{viewing.beneficiaryName?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>{formatExpiry(viewing.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Uso parcial</dt>
                  <dd>{viewing.allowPartial ? "Permitido" : "Somente total"}</dd>
                </div>
              </dl>

              <div className="service-view__actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setViewing(null)}
                >
                  Fechar
                </Button>
                {viewing.status === "PENDING_PAYMENT" ? (
                  <Button
                    type="button"
                    variant="gold"
                    disabled={activatingId === viewing.id}
                    onClick={() => onActivate(viewing.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {activatingId === viewing.id ? "Ativando..." : "Ativar"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="gold"
                    onClick={() => {
                      setRedeemCode(viewing.code);
                      setViewing(null);
                      setRedeemOpen(true);
                    }}
                  >
                    <ScanLine className="h-4 w-4" aria-hidden />
                    Debitar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {draft ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => setDraft(null)}
          />
          <Card className="agenda__modal-card agenda__modal-card--tall max-w-xl">
            <div className="agenda__modal-head">
              <h2>Emitir vale-presente</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Fechar
              </Button>
            </div>

            <form onSubmit={onIssue} className="agenda__form">
              <Campo label="Valor (R$)" obrigatorio>
                <Input
                  name="initialAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={draft.initialAmount}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, initialAmount: e.target.value } : prev,
                    )
                  }
                  placeholder="Ex.: 250,00"
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Comprador">
                  <Input
                    name="buyerName"
                    value={draft.buyerName}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, buyerName: e.target.value } : prev,
                      )
                    }
                    placeholder="Quem comprou"
                  />
                </Campo>
                <Campo label="Beneficiário">
                  <Input
                    name="beneficiaryName"
                    value={draft.beneficiaryName}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, beneficiaryName: e.target.value }
                          : prev,
                      )
                    }
                    placeholder="Quem vai usar"
                  />
                </Campo>
              </div>

              <Campo label="Mensagem">
                <Textarea
                  name="message"
                  value={draft.message}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, message: e.target.value } : prev,
                    )
                  }
                  placeholder="Mensagem opcional no vale..."
                />
              </Campo>

              <Campo label="Validade">
                <Input
                  name="expiresAt"
                  type="datetime-local"
                  value={draft.expiresAt}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, expiresAt: e.target.value } : prev,
                    )
                  }
                />
              </Campo>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.activate}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, activate: e.target.checked } : prev,
                    )
                  }
                />
                Ativar imediatamente
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.allowPartial}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, allowPartial: e.target.checked }
                        : prev,
                    )
                  }
                />
                Permitir uso parcial
              </label>

              <div className="agenda__form-acoes">
                <span />
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDraft(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="gold" disabled={saving}>
                    {saving ? "Emitindo..." : "Emitir"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {redeemOpen ? (
        <div className="agenda__modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="agenda__modal-backdrop"
            aria-label="Fechar"
            onClick={() => {
              setRedeemOpen(false);
              setRedeemCode("");
            }}
          />
          <Card className="agenda__modal-card max-w-lg">
            <div className="agenda__modal-head">
              <h2>Debitar vale</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRedeemOpen(false);
                  setRedeemCode("");
                }}
              >
                Fechar
              </Button>
            </div>

            <form onSubmit={onRedeem} className="agenda__form">
              <Campo label="Código" obrigatorio>
                <Input
                  name="code"
                  required
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="Ex.: GP1A2B3C4D"
                  autoComplete="off"
                />
              </Campo>
              <Campo label="Valor (R$)" obrigatorio>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Quanto debitar"
                />
              </Campo>
              <div className="agenda__form-acoes">
                <span />
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setRedeemOpen(false);
                      setRedeemCode("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="gold" disabled={redeeming}>
                    {redeeming ? "Debitando..." : "Debitar"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </>
  );
}
