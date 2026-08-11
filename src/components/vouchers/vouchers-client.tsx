"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Hash,
  Percent,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Campo,
  Card,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import {
  createVoucherAction,
  redeemVoucherAction,
} from "@/app/v2-actions";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

export type VoucherDTO = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  valueAmount: string | number | null;
  valuePercent: string | number | null;
  quantity: number | null;
  usedCount: number;
  status: string;
  expiresAt: string | null;
  _count?: { redemptions: number };
};

export type VoucherPatientOption = {
  id: string;
  fullName: string;
};

type Draft = {
  name: string;
  description: string;
  type: string;
  valueAmount: string;
  valuePercent: string;
  quantity: string;
  expiresAt: string;
};

type Props = {
  initialVouchers: VoucherDTO[];
  patients: VoucherPatientOption[];
};

type StatusFilter = "all" | "active" | "inactive";

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    type: "FIXED_VALUE",
    valueAmount: "",
    valuePercent: "",
    quantity: "",
    expiresAt: "",
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

function isActiveStatus(status: string) {
  return status === "ACTIVE";
}

function benefitHero(v: VoucherDTO) {
  if (v.type === "PERCENT" && v.valuePercent != null) {
    return {
      value: `${Number(v.valuePercent)}%`,
      label: "desconto percentual",
    };
  }
  if (v.valueAmount != null && Number(v.valueAmount) > 0) {
    return {
      value: formatBRL(Number(v.valueAmount)),
      label: labelPt(v.type).toLowerCase(),
    };
  }
  return {
    value: labelPt(v.type),
    label: "benefício",
  };
}

function usageLabel(v: VoucherDTO) {
  const used = v.usedCount ?? v._count?.redemptions ?? 0;
  const total = v.quantity;
  if (total == null) return `${used} usos · ilimitado`;
  return `${used}/${total} usos`;
}

export function VouchersClient({ initialVouchers, patients }: Props) {
  const router = useRouter();
  const [vouchers, setVouchers] = React.useState(initialVouchers);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [viewing, setViewing] = React.useState<VoucherDTO | null>(null);
  const [redeemOpen, setRedeemOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [saving, setSaving] = React.useState(false);
  const [redeeming, setRedeeming] = React.useState(false);

  React.useEffect(() => {
    setVouchers(initialVouchers);
  }, [initialVouchers]);

  const activeCount = vouchers.filter((v) => isActiveStatus(v.status)).length;
  const totalUses = vouchers.reduce(
    (acc, v) => acc + (v.usedCount ?? v._count?.redemptions ?? 0),
    0,
  );
  const remainingQty = vouchers.reduce((acc, v) => {
    if (v.quantity == null) return acc;
    return acc + Math.max(0, v.quantity - (v.usedCount ?? 0));
  }, 0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (statusFilter === "active" && !isActiveStatus(v.status)) return false;
      if (statusFilter === "inactive" && isActiveStatus(v.status)) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.description ?? "").toLowerCase().includes(q) ||
        labelPt(v.type).toLowerCase().includes(q)
      );
    });
  }, [vouchers, query, statusFilter]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await createVoucherAction(fd);
      if (!result.ok) {
        toast.error("Falha ao emitir", result.error);
        return;
      }
      setVouchers((prev) => [result.voucher as VoucherDTO, ...prev]);
      toast.success("Cupom emitido", result.voucher.code);
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
      const result = await redeemVoucherAction(fd);
      if (!result.ok) {
        toast.error("Falha ao resgatar", result.error);
        return;
      }
      const code = String(fd.get("code") || "").trim().toUpperCase();
      setVouchers((prev) =>
        prev.map((v) =>
          v.code.toUpperCase() === code
            ? {
                ...v,
                usedCount: (v.usedCount ?? 0) + 1,
                _count: {
                  redemptions: (v._count?.redemptions ?? v.usedCount ?? 0) + 1,
                },
              }
            : v,
        ),
      );
      toast.success("Cupom resgatado");
      setRedeemOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível resgatar",
      );
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <>
      <div className="services-hero">
        <p className="services-hero__eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Cupons rastreáveis
        </p>
        <h2 className="services-hero__title">
          Vouchers com código único e resgate controlado
        </h2>
        <p className="services-hero__desc">
          Emita cupons por valor, percentual ou cortesia — acompanhe usos,
          validade e resgate na recepção.
        </p>
      </div>

      <div className="services-stats">
        <div className="services-stat">
          <div className="services-stat__icon">
            <Ticket className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Cupons</p>
            <p className="services-stat__value">{vouchers.length}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--green">
            <Percent className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Ativos</p>
            <p className="services-stat__value">{activeCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--blue">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Resgates</p>
            <p className="services-stat__value">{totalUses}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--gold">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Saldo de usos</p>
            <p className="services-stat__value">{remainingQty}</p>
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
              placeholder="Buscar por nome, código ou tipo"
              aria-label="Buscar cupons"
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
                { id: "active", label: "Ativos" },
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
              onClick={() => setRedeemOpen(true)}
            >
              <ScanLine className="h-4 w-4" aria-hidden />
              Resgatar
            </Button>
            <Button
              type="button"
              variant="gold"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Emitir cupom
            </Button>
          </div>
        </div>
        <p className="services-toolbar__hint">
          {filtered.length === vouchers.length
            ? `${vouchers.length} cupom${vouchers.length === 1 ? "" : "s"}`
            : `Mostrando ${filtered.length} de ${vouchers.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="services-empty">
          <div className="services-empty__icon">
            <Ticket className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="services-empty__title">
            {vouchers.length === 0
              ? "Nenhum cupom emitido"
              : "Nenhum resultado para esta busca"}
          </h3>
          <p className="services-empty__desc">
            {vouchers.length === 0
              ? "Emita o primeiro cupom com valor, percentual ou cortesia — depois resgate pelo código."
              : "Tente outro termo ou limpe os filtros para ver todos os cupons."}
          </p>
          <div className="services-empty__actions">
            {vouchers.length > 0 ? (
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
              Emitir cupom
            </Button>
          </div>
        </div>
      ) : (
        <div className="services-grid">
          {filtered.map((voucher) => {
            const hero = benefitHero(voucher);
            return (
              <article
                key={voucher.id}
                className={cn(
                  "service-card",
                  !isActiveStatus(voucher.status) && "service-card--inactive",
                )}
              >
                <div className="service-card__header">
                  <div className="service-card__icon" aria-hidden>
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="service-card__title">{voucher.name}</h3>
                    <p className="service-card__code">{voucher.code}</p>
                    <div className="service-card__badges">
                      <Badge
                        tone={
                          isActiveStatus(voucher.status) ? "success" : "muted"
                        }
                      >
                        {labelPt(voucher.status)}
                      </Badge>
                      <Badge tone="gold">{labelPt(voucher.type)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="service-card__hero">
                  <p className="service-card__price">{hero.value}</p>
                  <p className="service-card__price-label">{hero.label}</p>
                </div>

                <p className="service-card__desc">
                  {voucher.description?.trim()
                    ? voucher.description
                    : "Sem descrição — adicione o benefício e as regras do cupom."}
                </p>

                <div className="service-card__meta">
                  <span className="service-chip">
                    <Hash aria-hidden />
                    {usageLabel(voucher)}
                  </span>
                  <span className="service-chip">
                    <Wallet aria-hidden />
                    {formatExpiry(voucher.expiresAt)}
                  </span>
                </div>

                <div className="service-card__footer">
                  <Button
                    type="button"
                    size="sm"
                    variant="contorno"
                    onClick={() => setViewing(voucher)}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    Visualizar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setRedeemOpen(true)}
                  >
                    <ScanLine className="h-3.5 w-3.5" aria-hidden />
                    Resgatar
                  </Button>
                </div>
              </article>
            );
          })}
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
              <h2>Detalhes do cupom</h2>
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
                  <h3 className="service-view__name">{viewing.name}</h3>
                  <p className="service-view__code">{viewing.code}</p>
                </div>
                <div className="service-view__badges">
                  <Badge
                    tone={isActiveStatus(viewing.status) ? "success" : "muted"}
                  >
                    {labelPt(viewing.status)}
                  </Badge>
                </div>
              </div>

              <p className="service-view__price">
                {benefitHero(viewing).value}
              </p>
              <p className="service-view__price-label">
                {benefitHero(viewing).label}
              </p>

              <p className="service-view__desc">
                {viewing.description?.trim()
                  ? viewing.description
                  : "Sem descrição cadastrada."}
              </p>

              <dl className="service-view__grid">
                <div>
                  <dt>Tipo</dt>
                  <dd>{labelPt(viewing.type)}</dd>
                </div>
                <div>
                  <dt>Usos</dt>
                  <dd>{usageLabel(viewing)}</dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>{formatExpiry(viewing.expiresAt)}</dd>
                </div>
                <div>
                  <dt>Valor</dt>
                  <dd>
                    {viewing.valueAmount != null
                      ? formatBRL(Number(viewing.valueAmount))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Percentual</dt>
                  <dd>
                    {viewing.valuePercent != null
                      ? `${Number(viewing.valuePercent)}%`
                      : "—"}
                  </dd>
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
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => {
                    setViewing(null);
                    setRedeemOpen(true);
                  }}
                >
                  <ScanLine className="h-4 w-4" aria-hidden />
                  Resgatar
                </Button>
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
              <h2>Emitir cupom</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Fechar
              </Button>
            </div>

            <form onSubmit={onSave} className="agenda__form">
              <Campo label="Nome" obrigatorio>
                <Input
                  name="name"
                  required
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev,
                    )
                  }
                  placeholder="Ex.: Boas-vindas R$ 50"
                />
              </Campo>

              <Campo label="Descrição">
                <Textarea
                  name="description"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev,
                    )
                  }
                  placeholder="Regras, público e restrições do cupom..."
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Tipo" obrigatorio>
                  <Select
                    name="type"
                    value={draft.type}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, type: e.target.value } : prev,
                      )
                    }
                  >
                    <option value="FIXED_VALUE">Valor fixo</option>
                    <option value="PERCENT">Percentual</option>
                    <option value="COURTESY">Cortesia</option>
                    <option value="BIRTHDAY">Aniversário</option>
                    <option value="RECOVERY">Recuperação</option>
                  </Select>
                </Campo>
                <Campo label="Quantidade">
                  <Input
                    name="quantity"
                    type="number"
                    min="1"
                    value={draft.quantity}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, quantity: e.target.value } : prev,
                      )
                    }
                    placeholder="Ilimitado"
                  />
                </Campo>
              </div>

              <div className="agenda__form-grid">
                <Campo label="Valor (R$)">
                  <Input
                    name="valueAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.valueAmount}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, valueAmount: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
                <Campo label="Percentual (%)">
                  <Input
                    name="valuePercent"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.valuePercent}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, valuePercent: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
              </div>

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
            onClick={() => setRedeemOpen(false)}
          />
          <Card className="agenda__modal-card max-w-lg">
            <div className="agenda__modal-head">
              <h2>Resgatar cupom</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRedeemOpen(false)}
              >
                Fechar
              </Button>
            </div>

            <form onSubmit={onRedeem} className="agenda__form">
              <Campo label="Código" obrigatorio>
                <Input
                  name="code"
                  required
                  placeholder="Ex.: VC1A2B3C4D"
                  autoComplete="off"
                />
              </Campo>
              <Campo label="Paciente" obrigatorio>
                <Select name="patientId" required defaultValue="">
                  <option value="">Selecione</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </Select>
              </Campo>
              <div className="agenda__form-acoes">
                <span />
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRedeemOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="gold" disabled={redeeming}>
                    {redeeming ? "Resgatando..." : "Resgatar"}
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
