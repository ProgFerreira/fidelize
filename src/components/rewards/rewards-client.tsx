"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Gift,
  Package,
  Pencil,
  Plus,
  Power,
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
  createRewardAction,
  fulfillRewardAction,
  redeemRewardAction,
  setRewardStatusAction,
  updateRewardAction,
} from "@/app/reward-actions";
import type {
  RewardDTO,
  RewardPatientOption,
  RewardRedemptionDTO,
} from "@/lib/rewards";
import { labelPt } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

type Props = {
  initialRewards: RewardDTO[];
  initialRedemptions: RewardRedemptionDTO[];
  patients: RewardPatientOption[];
  canFulfill: boolean;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  pointsCost: string;
  stockTotal: string;
  limitPerPatient: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  rules: string;
};

type StatusFilter = "all" | "active" | "inactive";

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    pointsCost: "100",
    stockTotal: "",
    limitPerPatient: "1",
    status: "ACTIVE",
    rules: "",
  };
}

function fromReward(r: RewardDTO): Draft {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    pointsCost: String(r.pointsCost),
    stockTotal: r.stockTotal == null ? "" : String(r.stockTotal),
    limitPerPatient:
      r.limitPerPatient == null ? "" : String(r.limitPerPatient),
    status: r.status,
    rules: r.rules ?? "",
  };
}

function stockAvailable(r: RewardDTO) {
  if (r.stockTotal == null) return null;
  return Math.max(0, r.stockTotal - r.stockReserved - r.stockFulfilled);
}

function averagePoints(items: RewardDTO[]) {
  const active = items.filter((r) => r.status === "ACTIVE");
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, r) => acc + r.pointsCost, 0);
  return Math.round(sum / active.length);
}

function toRewardDto(reward: RewardDTO | Record<string, unknown>): RewardDTO {
  const r = reward as RewardDTO;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    pointsCost: Number(r.pointsCost),
    stockTotal: r.stockTotal == null ? null : Number(r.stockTotal),
    stockReserved: Number(r.stockReserved ?? 0),
    stockFulfilled: Number(r.stockFulfilled ?? 0),
    limitPerPatient:
      r.limitPerPatient == null ? null : Number(r.limitPerPatient),
    rules: r.rules ?? null,
    status: r.status,
  };
}

export function RewardsClient({
  initialRewards,
  initialRedemptions,
  patients,
  canFulfill,
}: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialRewards);
  const [redemptions, setRedemptions] = React.useState(initialRedemptions);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setItems(initialRewards);
  }, [initialRewards]);

  React.useEffect(() => {
    setRedemptions(initialRedemptions);
  }, [initialRedemptions]);

  const activeCount = items.filter((r) => r.status === "ACTIVE").length;
  const pendingCount = redemptions.filter(
    (r) => r.status === "PENDING_FULFILLMENT",
  ).length;
  const avg = averagePoints(items);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter === "active" && r.status !== "ACTIVE") return false;
      if (statusFilter === "inactive" && r.status === "ACTIVE") return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.rules ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.set("status", draft.status);
    try {
      if (draft.id) {
        const res = await updateRewardAction(draft.id, fd);
        const next = toRewardDto(res.reward);
        setItems((prev) => prev.map((r) => (r.id === next.id ? next : r)));
        toast.success("Recompensa atualizada");
      } else {
        const res = await createRewardAction(fd);
        const next = toRewardDto(res.reward);
        setItems((prev) => [next, ...prev]);
        toast.success("Recompensa cadastrada");
      }
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onToggleStatus(reward: RewardDTO) {
    const nextStatus = reward.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusyId(reward.id);
    try {
      const res = await setRewardStatusAction(reward.id, nextStatus);
      const next = toRewardDto(res.reward);
      setItems((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      toast.success(
        nextStatus === "ACTIVE" ? "Recompensa ativada" : "Recompensa pausada",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao alterar status",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onRedeem(e: React.FormEvent<HTMLFormElement>, rewardId: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const patientId = String(fd.get("patientId") || "");
    if (!patientId) {
      toast.error("Selecione um paciente");
      return;
    }
    setBusyId(rewardId);
    try {
      await redeemRewardAction(fd);
      toast.success("Resgate registrado — aguardando entrega");
      form.reset();
      setItems((prev) =>
        prev.map((r) =>
          r.id === rewardId
            ? { ...r, stockReserved: r.stockReserved + 1 }
            : r,
        ),
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível resgatar",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onFulfill(redemptionId: string) {
    setBusyId(redemptionId);
    try {
      const fd = new FormData();
      fd.set("redemptionId", redemptionId);
      await fulfillRewardAction(fd);
      setRedemptions((prev) =>
        prev.map((r) =>
          r.id === redemptionId ? { ...r, status: "FULFILLED" } : r,
        ),
      );
      toast.success("Entrega confirmada");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao confirmar entrega",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="services-hero">
        <p className="services-hero__eyebrow">
          <Gift className="h-3.5 w-3.5" aria-hidden />
          Clube de pontos
        </p>
        <h2 className="services-hero__title">
          Recompensas claras, com estoque e entrega na recepção
        </h2>
        <p className="services-hero__desc">
          Monte o catálogo de trocas por pontos — custo, limite por paciente e
          confirmação de entrega no balcão.
        </p>
      </div>

      <div className="services-stats">
        <div className="services-stat">
          <div className="services-stat__icon">
            <Gift className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">No catálogo</p>
            <p className="services-stat__value">{items.length}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--green">
            <Power className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Ativas</p>
            <p className="services-stat__value">{activeCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--blue">
            <Package className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Aguardando entrega</p>
            <p className="services-stat__value">{pendingCount}</p>
          </div>
        </div>
        <div className="services-stat">
          <div className="services-stat__icon services-stat__icon--gold">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="services-stat__label">Custo médio</p>
            <p className="services-stat__value">{avg} pts</p>
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
              placeholder="Buscar por nome, descrição ou regras"
              aria-label="Buscar no catálogo"
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
                { id: "inactive", label: "Inativas" },
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
              variant="gold"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nova recompensa
            </Button>
          </div>
        </div>
        <p className="services-toolbar__hint">
          {filtered.length === items.length
            ? `${items.length} recompensa${items.length === 1 ? "" : "s"} no catálogo`
            : `Mostrando ${filtered.length} de ${items.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="services-empty">
          <div className="services-empty__icon">
            <Gift className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="services-empty__title">
            {items.length === 0
              ? "Nenhuma recompensa no catálogo"
              : "Nenhum resultado para esta busca"}
          </h3>
          <p className="services-empty__desc">
            {items.length === 0
              ? "Cadastre trocas por pontos com estoque e limite por paciente — a recepção confirma a entrega."
              : "Tente outro termo ou limpe os filtros para ver o catálogo completo."}
          </p>
          <div className="services-empty__actions">
            {items.length > 0 ? (
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
              Cadastrar recompensa
            </Button>
          </div>
        </div>
      ) : (
        <div className="services-grid">
          {filtered.map((r) => {
            const available = stockAvailable(r);
            return (
              <article
                key={r.id}
                className={cn(
                  "service-card",
                  r.status !== "ACTIVE" && "service-card--inactive",
                )}
              >
                <div className="service-card__header">
                  <div className="service-card__icon" aria-hidden>
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="service-card__title">{r.name}</h3>
                    <p className="service-card__code">
                      {available == null
                        ? "Estoque ilimitado"
                        : `${available} em estoque`}
                    </p>
                    <div className="service-card__badges">
                      <Badge
                        tone={r.status === "ACTIVE" ? "success" : "muted"}
                      >
                        {labelPt(r.status)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="service-card__hero">
                  <p className="service-card__price">{r.pointsCost}</p>
                  <p className="service-card__price-label">pontos</p>
                </div>

                <p className="service-card__desc">
                  {r.description?.trim()
                    ? r.description
                    : "Sem descrição — adicione detalhes do benefício para a equipe e o paciente."}
                </p>

                <div className="service-card__meta">
                  <span className="service-chip">
                    <Users aria-hidden />
                    {r.limitPerPatient != null
                      ? `Limite ${r.limitPerPatient}/paciente`
                      : "Sem limite/paciente"}
                  </span>
                  <span className="service-chip">
                    <Package aria-hidden />
                    {r.stockTotal != null
                      ? `Total ${r.stockTotal}`
                      : "Sem teto de estoque"}
                  </span>
                  {r.stockFulfilled > 0 ? (
                    <span className="service-chip">
                      <CheckCircle2 aria-hidden />
                      {r.stockFulfilled} entregues
                    </span>
                  ) : null}
                </div>

                {r.status === "ACTIVE" ? (
                  <form
                    onSubmit={(e) => void onRedeem(e, r.id)}
                    className="service-card__pros flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="rewardId" value={r.id} />
                    <div className="min-w-[160px] flex-1">
                      <Select
                        name="patientId"
                        required
                        defaultValue=""
                        aria-label={`Paciente para resgatar ${r.name}`}
                      >
                        <option value="">Paciente</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      variant="gold"
                      disabled={busyId === r.id}
                    >
                      <Ticket className="h-3.5 w-3.5" aria-hidden />
                      Resgatar
                    </Button>
                  </form>
                ) : (
                  <p className="service-card__pros">
                    Ative a recompensa para liberar resgates na recepção.
                  </p>
                )}

                <div className="service-card__footer">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setDraft(fromReward(r))}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={r.status === "ACTIVE" ? "danger" : "secondary"}
                    disabled={busyId === r.id}
                    onClick={() => void onToggleStatus(r)}
                  >
                    <Power className="h-3.5 w-3.5" aria-hidden />
                    {r.status === "ACTIVE" ? "Pausar" : "Ativar"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="rewards-redemptions">
        <div className="rewards-redemptions__head">
          <h2 className="rewards-redemptions__title">
            <Sparkles className="h-4 w-4" aria-hidden />
            Resgates recentes
          </h2>
          <p className="rewards-redemptions__hint">
            Confirme a entrega física na recepção para baixar o estoque.
          </p>
        </div>

        {redemptions.length === 0 ? (
          <div className="services-empty" style={{ padding: "1.75rem 1.25rem" }}>
            <p className="services-empty__desc" style={{ margin: 0 }}>
              Ainda não há resgates registrados.
            </p>
          </div>
        ) : (
          <div className="rewards-redemptions__list">
            {redemptions.map((row) => (
              <article key={row.id} className="rewards-redemption">
                <div className="min-w-0 flex-1">
                  <p className="rewards-redemption__title">
                    {row.patient.fullName} · {row.reward.name}
                  </p>
                  <p className="rewards-redemption__meta">
                    Código {row.code} · {row.pointsSpent} pts
                  </p>
                </div>
                <div className="rewards-redemption__actions">
                  <Badge
                    tone={
                      row.status === "FULFILLED"
                        ? "success"
                        : row.status === "PENDING_FULFILLMENT"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {labelPt(row.status)}
                  </Badge>
                  {canFulfill && row.status === "PENDING_FULFILLMENT" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void onFulfill(row.id)}
                    >
                      Confirmar entrega
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
              <h2>{draft.id ? "Editar recompensa" : "Nova recompensa"}</h2>
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
                    setDraft((p) => (p ? { ...p, name: e.target.value } : p))
                  }
                  placeholder="Ex.: Sessão de limpeza de pele"
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Pontos" obrigatorio>
                  <Input
                    name="pointsCost"
                    type="number"
                    min="1"
                    required
                    value={draft.pointsCost}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, pointsCost: e.target.value } : p,
                      )
                    }
                  />
                </Campo>
                <Campo label="Estoque total">
                  <Input
                    name="stockTotal"
                    type="number"
                    min="0"
                    value={draft.stockTotal}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, stockTotal: e.target.value } : p,
                      )
                    }
                    placeholder="Ilimitado se vazio"
                  />
                </Campo>
              </div>

              <div className="agenda__form-grid">
                <Campo label="Limite por paciente">
                  <Input
                    name="limitPerPatient"
                    type="number"
                    min="1"
                    value={draft.limitPerPatient}
                    onChange={(e) =>
                      setDraft((p) =>
                        p ? { ...p, limitPerPatient: e.target.value } : p,
                      )
                    }
                  />
                </Campo>
                <Campo label="Status">
                  <Select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((p) =>
                        p
                          ? {
                              ...p,
                              status: e.target.value as Draft["status"],
                            }
                          : p,
                      )
                    }
                  >
                    <option value="ACTIVE">Ativa</option>
                    <option value="DRAFT">Rascunho</option>
                    <option value="PAUSED">Pausada</option>
                    <option value="ENDED">Encerrada</option>
                  </Select>
                </Campo>
              </div>

              <Campo label="Descrição">
                <Textarea
                  name="description"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((p) =>
                      p ? { ...p, description: e.target.value } : p,
                    )
                  }
                  placeholder="O que o paciente recebe ao resgatar..."
                />
              </Campo>

              <Campo label="Regras (opcional)">
                <Textarea
                  name="rules"
                  value={draft.rules}
                  onChange={(e) =>
                    setDraft((p) => (p ? { ...p, rules: e.target.value } : p))
                  }
                  placeholder="Restrições, validade, combinações..."
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
                  <Button type="submit" disabled={saving}>
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
