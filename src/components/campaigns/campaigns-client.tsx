"use client";

import * as React from "react";
import {
  CalendarRange,
  Eye,
  Megaphone,
  Pencil,
  Percent,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
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
import { saveCampaignAction } from "@/app/actions";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";
import { toClientProps } from "@/lib/serialize";

export type CampaignDTO = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  extraCashbackPct: string | number;
  extraPoints: number;
  benefitDescription: string | null;
  couponCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type CampaignRoiDTO = {
  id: string;
  impacted: number;
  attributedVisits: number;
  revenue: number | string;
  benefitCost: number | string;
  commCost: number | string;
  netRevenue: number | string;
  roi: number | null;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  status: string;
  extraCashbackPct: string;
  extraPoints: string;
  benefitDescription: string;
  couponCode: string;
  startsAt: string;
  endsAt: string;
};

type Props = {
  initialCampaigns: CampaignDTO[];
  initialRois: CampaignRoiDTO[];
};

type StatusFilter = "all" | "active" | "inactive";

function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function formatPeriod(startsAt: string | null, endsAt: string | null) {
  const fmt = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const start = fmt(startsAt);
  const end = fmt(endsAt);
  if (start && end) return `${start} — ${end}`;
  if (start) return `A partir de ${start}`;
  if (end) return `Até ${end}`;
  return "Sem vigência definida";
}

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    status: "ACTIVE",
    extraCashbackPct: "2",
    extraPoints: "50",
    benefitDescription: "",
    couponCode: "",
    startsAt: "",
    endsAt: "",
  };
}

function fromCampaign(c: CampaignDTO): Draft {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    status: c.status,
    extraCashbackPct: String(c.extraCashbackPct ?? "0"),
    extraPoints: String(c.extraPoints ?? 0),
    benefitDescription: c.benefitDescription ?? "",
    couponCode: c.couponCode ?? "",
    startsAt: toDateTimeLocalValue(c.startsAt),
    endsAt: toDateTimeLocalValue(c.endsAt),
  };
}

function emptyRoi(id: string): CampaignRoiDTO {
  return {
    id,
    impacted: 0,
    attributedVisits: 0,
    revenue: 0,
    benefitCost: 0,
    commCost: 0,
    netRevenue: 0,
    roi: null,
  };
}

function isActiveStatus(status: string) {
  return status === "ACTIVE";
}

export function CampaignsClient({ initialCampaigns, initialRois }: Props) {
  const [campaigns, setCampaigns] = React.useState(initialCampaigns);
  const [rois, setRois] = React.useState(initialRois);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [viewing, setViewing] = React.useState<CampaignDTO | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setCampaigns(initialCampaigns);
  }, [initialCampaigns]);

  React.useEffect(() => {
    setRois(initialRois);
  }, [initialRois]);

  const roiById = Object.fromEntries(rois.map((r) => [r.id, r]));

  const activeCount = campaigns.filter((c) => isActiveStatus(c.status)).length;
  const totalImpacted = rois.reduce((acc, r) => acc + (r.impacted || 0), 0);
  const totalRevenue = rois.reduce((acc, r) => acc + Number(r.revenue || 0), 0);
  const roisWithValue = rois.filter((r) => r.roi != null);
  const avgRoi =
    roisWithValue.length === 0
      ? null
      : roisWithValue.reduce((acc, r) => acc + Number(r.roi), 0) /
        roisWithValue.length;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter === "active" && !isActiveStatus(c.status)) return false;
      if (statusFilter === "inactive" && isActiveStatus(c.status)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.couponCode ?? "").toLowerCase().includes(q) ||
        (c.benefitDescription ?? "").toLowerCase().includes(q)
      );
    });
  }, [campaigns, query, statusFilter]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    if (draft.id) fd.set("id", draft.id);
    try {
      const result = await saveCampaignAction(fd);
      if (!result.ok) {
        toast.error("Falha ao salvar", result.error);
        return;
      }
      const saved = toClientProps<CampaignDTO>(result.campaign);
      setCampaigns((prev) => {
        const exists = prev.some((c) => c.id === saved.id);
        if (exists) {
          return prev.map((c) => (c.id === saved.id ? saved : c));
        }
        return [saved, ...prev];
      });
      setRois((prev) => {
        if (prev.some((r) => r.id === saved.id)) return prev;
        return [...prev, emptyRoi(saved.id)];
      });
      toast.success(draft.id ? "Campanha atualizada" : "Campanha criada");
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  const viewingRoi = viewing ? roiById[viewing.id] : null;

  return (
    <>
      <div className="services-hero">
        <p className="services-hero__eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Engajamento e retorno
        </p>
        <h2 className="services-hero__title">
          Campanhas com benefício claro e ROI mensurável
        </h2>
        <p className="services-hero__desc">
          Defina cashback, pontos e vigência — acompanhe impacto, receita e
          retorno de cada ação promocional.
        </p>
      </div>

      <div className="services-stats">
        <div className="services-stat">
          <div className="services-stat__icon">
            <Megaphone className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Campanhas</p>
            <p className="services-stat__value">{campaigns.length}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--green">
            <Percent className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Ativas</p>
            <p className="services-stat__value">{activeCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--blue">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Impactados</p>
            <p className="services-stat__value">{totalImpacted}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--gold">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">
              {avgRoi == null ? "Receita" : "ROI médio"}
            </p>
            <p className="services-stat__value">
              {avgRoi == null ? formatBRL(totalRevenue) : `${avgRoi.toFixed(0)}%`}
            </p>
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
              placeholder="Buscar por nome, cupom ou benefício"
              aria-label="Buscar campanhas"
            />
          </div>

          <div
            className="services-toolbar__filters"
            role="group"
            aria-label="Filtrar status"
          >
            {(
              [
                { id: "all", label: "Todas" },
                { id: "active", label: "Ativas" },
                { id: "inactive", label: "Outras" },
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
              variante="gold"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nova campanha
            </Button>
          </div>
        </div>
        <p className="services-toolbar__hint">
          {filtered.length === campaigns.length
            ? `${campaigns.length} campanha${campaigns.length === 1 ? "" : "s"}`
            : `Mostrando ${filtered.length} de ${campaigns.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="services-empty">
          <div className="services-empty__icon">
            <Megaphone className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="services-empty__title">
            {campaigns.length === 0
              ? "Nenhuma campanha cadastrada"
              : "Nenhum resultado para esta busca"}
          </h3>
          <p className="services-empty__desc">
            {campaigns.length === 0
              ? "Crie a primeira campanha com cashback, pontos extras e vigência — depois acompanhe o ROI."
              : "Tente outro termo ou limpe os filtros para ver todas as campanhas."}
          </p>
          <div className="services-empty__actions">
            {campaigns.length > 0 ? (
              <Button
                type="button"
                variante="contorno"
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
              variante="gold"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Criar campanha
            </Button>
          </div>
        </div>
      ) : (
        <div className="services-grid">
          {filtered.map((campaign) => {
            const roi = roiById[campaign.id];
            const cost =
              roi != null
                ? Number(roi.benefitCost) + Number(roi.commCost)
                : 0;
            return (
              <article
                key={campaign.id}
                className={cn(
                  "service-card",
                  !isActiveStatus(campaign.status) && "service-card--inactive",
                )}
              >
                <div className="service-card__header">
                  <div className="service-card__icon" aria-hidden>
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="service-card__title">{campaign.name}</h3>
                    <p className="service-card__code">
                      {campaign.couponCode
                        ? `Cupom ${campaign.couponCode}`
                        : "Sem cupom"}
                    </p>
                    <div className="service-card__badges">
                      <Badge
                        tone={
                          isActiveStatus(campaign.status) ? "success" : "muted"
                        }
                      >
                        {labelPt(campaign.status)}
                      </Badge>
                      {Number(campaign.extraCashbackPct) > 0 ? (
                        <Badge tone="gold">Cashback</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="service-card__hero">
                  <p className="service-card__price">
                    +{Number(campaign.extraCashbackPct)}%
                  </p>
                  <p className="service-card__price-label">
                    {campaign.extraPoints
                      ? `cashback · +${campaign.extraPoints} pts`
                      : "cashback extra"}
                  </p>
                </div>

                <p className="service-card__desc">
                  {campaign.description?.trim()
                    ? campaign.description
                    : campaign.benefitDescription?.trim()
                      ? campaign.benefitDescription
                      : "Sem descrição — adicione o benefício e o público-alvo da campanha."}
                </p>

                <div className="service-card__meta">
                  <span className="service-chip">
                    <CalendarRange aria-hidden />
                    {formatPeriod(campaign.startsAt, campaign.endsAt)}
                  </span>
                  {roi ? (
                    <>
                      <span className="service-chip">
                        <Users aria-hidden />
                        {roi.impacted} impactados
                      </span>
                      <span className="service-chip">
                        <TrendingUp aria-hidden />
                        {roi.roi == null ? "ROI —" : `ROI ${roi.roi}%`}
                      </span>
                    </>
                  ) : null}
                </div>

                <p className="service-card__pros">
                  {roi ? (
                    <>
                      <strong>Receita:</strong> {formatBRL(roi.revenue)}
                      {" · "}
                      <strong>Líquido:</strong> {formatBRL(roi.netRevenue)}
                      {cost > 0 ? (
                        <>
                          {" · "}
                          <strong>Custo:</strong> {formatBRL(cost)}
                        </>
                      ) : null}
                    </>
                  ) : (
                    "Sem métricas de ROI ainda"
                  )}
                </p>

                <div className="service-card__footer">
                  <Button
                    type="button"
                    tamanho="sm"
                    variante="contorno"
                    onClick={() => setViewing(campaign)}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    Visualizar
                  </Button>
                  <Button
                    type="button"
                    tamanho="sm"
                    variante="secundario"
                    onClick={() => setDraft(fromCampaign(campaign))}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Editar
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
              <h2>Detalhes da campanha</h2>
              <Button
                type="button"
                variante="secundario"
                tamanho="sm"
                onClick={() => setViewing(null)}
              >
                Fechar
              </Button>
            </div>

            <div className="service-view">
              <div className="service-view__title-row">
                <div className="min-w-0">
                  <h3 className="service-view__name">{viewing.name}</h3>
                  <p className="service-view__code">
                    {viewing.couponCode
                      ? `Cupom ${viewing.couponCode}`
                      : "Sem cupom"}
                  </p>
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
                +{Number(viewing.extraCashbackPct)}%
              </p>
              <p className="service-view__price-label">
                {viewing.extraPoints
                  ? `cashback · +${viewing.extraPoints} pts`
                  : "cashback extra"}
              </p>

              <p className="service-view__desc">
                {viewing.description?.trim()
                  ? viewing.description
                  : "Sem descrição cadastrada."}
              </p>

              <dl className="service-view__grid">
                <div>
                  <dt>Vigência</dt>
                  <dd>{formatPeriod(viewing.startsAt, viewing.endsAt)}</dd>
                </div>
                <div>
                  <dt>Benefício</dt>
                  <dd>
                    {viewing.benefitDescription?.trim()
                      ? viewing.benefitDescription
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Impactados</dt>
                  <dd>{viewingRoi?.impacted ?? 0}</dd>
                </div>
                <div>
                  <dt>Retornos</dt>
                  <dd>{viewingRoi?.attributedVisits ?? 0}</dd>
                </div>
                <div>
                  <dt>Receita</dt>
                  <dd>{formatBRL(viewingRoi?.revenue ?? 0)}</dd>
                </div>
                <div>
                  <dt>ROI</dt>
                  <dd>
                    {viewingRoi?.roi == null ? "—" : `${viewingRoi.roi}%`}
                  </dd>
                </div>
              </dl>

              {viewingRoi ? (
                <div className="service-view__pros">
                  <p className="service-view__pros-label">Resultado financeiro</p>
                  <p>
                    Líquido {formatBRL(viewingRoi.netRevenue)}
                    {" · "}
                    Custo{" "}
                    {formatBRL(
                      Number(viewingRoi.benefitCost) +
                        Number(viewingRoi.commCost),
                    )}
                  </p>
                </div>
              ) : null}

              <div className="service-view__actions">
                <Button
                  type="button"
                  variante="secundario"
                  onClick={() => setViewing(null)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  variante="gold"
                  onClick={() => {
                    setDraft(fromCampaign(viewing));
                    setViewing(null);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Editar
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
              <h2>{draft.id ? "Editar campanha" : "Nova campanha"}</h2>
              <Button
                type="button"
                variante="secundario"
                tamanho="sm"
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
                  placeholder="Ex.: Volta às aulas com cashback"
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
                  placeholder="Público, mensagem e regras da campanha..."
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Cashback extra %">
                  <Input
                    name="extraCashbackPct"
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.extraCashbackPct}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, extraCashbackPct: e.target.value }
                          : prev,
                      )
                    }
                  />
                </Campo>
                <Campo label="Pontos extras">
                  <Input
                    name="extraPoints"
                    type="number"
                    min="0"
                    value={draft.extraPoints}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, extraPoints: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
              </div>

              <div className="agenda__form-grid">
                <Campo label="Início">
                  <Input
                    name="startsAt"
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, startsAt: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
                <Campo label="Fim">
                  <Input
                    name="endsAt"
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, endsAt: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
              </div>

              <div className="agenda__form-grid">
                <Campo label="Status">
                  <Select
                    name="status"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, status: e.target.value } : prev,
                      )
                    }
                  >
                    <option value="DRAFT">Rascunho</option>
                    <option value="SCHEDULED">Agendada</option>
                    <option value="ACTIVE">Ativa</option>
                    <option value="ENDED">Encerrada</option>
                    <option value="CANCELLED">Cancelada</option>
                  </Select>
                </Campo>
                <Campo label="Cupom">
                  <Input
                    name="couponCode"
                    value={draft.couponCode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, couponCode: e.target.value } : prev,
                      )
                    }
                    placeholder="Opcional"
                  />
                </Campo>
              </div>

              <Campo label="Benefício">
                <Input
                  name="benefitDescription"
                  value={draft.benefitDescription}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, benefitDescription: e.target.value }
                        : prev,
                    )
                  }
                  placeholder="Ex.: +2% cashback em procedimentos"
                />
              </Campo>

              <div className="agenda__form-acoes">
                <span />
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variante="secundario"
                    onClick={() => setDraft(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variante="gold" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
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
