"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Campo,
  Card,
  EmptyState,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import {
  createProfessionalAction,
  toggleProfessionalActiveAction,
  updateProfessionalAction,
} from "@/app/professional-actions";
import type { ProfessionalDTO } from "@/lib/professionals";
import { resolveServicePrice } from "@/lib/professionals/price";
import { Eye, Pencil, Power, Stethoscope } from "lucide-react";
import { formatBRL } from "@/lib/money";

type ProcedureOption = {
  id: string;
  name: string;
  basePrice: number;
  validityDays: number | null;
  durationMinutes: number | null;
};

type Props = {
  initialProfessionals: ProfessionalDTO[];
  procedures: ProcedureOption[];
};

type Draft = {
  id?: string;
  name: string;
  specialty: string;
  notes: string;
  active: boolean;
  color: string;
  commissionPercent: string;
  procedureIds: string[];
  procedurePrices: Record<string, string>;
};

function emptyDraft(): Draft {
  return {
    name: "",
    specialty: "",
    notes: "",
    active: true,
    color: "#3b82f6",
    commissionPercent: "",
    procedureIds: [],
    procedurePrices: {},
  };
}

function fromProfessional(p: ProfessionalDTO): Draft {
  const procedurePrices: Record<string, string> = {};
  for (const id of p.procedureIds) {
    const override = p.procedurePrices?.[id];
    procedurePrices[id] = override == null ? "" : String(override);
  }
  return {
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    notes: p.notes ?? "",
    active: p.active,
    color: p.color || "#3b82f6",
    commissionPercent:
      p.commissionPercent == null ? "" : String(p.commissionPercent),
    procedureIds: [...p.procedureIds],
    procedurePrices,
  };
}

export function ProfessionalsClient({
  initialProfessionals,
  procedures,
}: Props) {
  const [items, setItems] = React.useState(initialProfessionals);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [viewing, setViewing] = React.useState<ProfessionalDTO | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setItems(initialProfessionals);
  }, [initialProfessionals]);

  function toggleProcedure(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const has = prev.procedureIds.includes(id);
      const nextPrices = { ...prev.procedurePrices };
      if (has) delete nextPrices[id];
      else if (nextPrices[id] == null) nextPrices[id] = "";
      return {
        ...prev,
        procedureIds: has
          ? prev.procedureIds.filter((x) => x !== id)
          : [...prev.procedureIds, id],
        procedurePrices: nextPrices,
      };
    });
  }

  function setProcedurePrice(id: string, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        procedurePrices: { ...prev.procedurePrices, [id]: value },
      };
    });
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    for (const id of draft.procedureIds) {
      fd.append("procedureIds", id);
      fd.set(`procedurePrice_${id}`, draft.procedurePrices[id] ?? "");
    }
    fd.set("active", draft.active ? "true" : "false");
    try {
      if (draft.id) {
        const res = await updateProfessionalAction(draft.id, fd);
        setItems((prev) =>
          prev.map((p) =>
            p.id === res.professional.id ? res.professional : p,
          ),
        );
        toast.success("Profissional atualizado");
      } else {
        const res = await createProfessionalAction(fd);
        setItems((prev) => [res.professional, ...prev]);
        toast.success("Profissional cadastrado");
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

  async function onToggleActive(id: string, active: boolean) {
    try {
      await toggleProfessionalActiveAction(id, active);
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active } : p)),
      );
      toast.success(active ? "Profissional ativado" : "Profissional inativado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao alterar status",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Cadastre quem atende e o preço de cada tipo de atendimento.
        </p>
        <Button
          type="button"
          onClick={() => setDraft(emptyDraft())}
        >
          Novo profissional
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          titulo="Nenhum profissional"
          descricao="Cadastre o primeiro profissional para selecioná-lo na agenda."
          icone={Stethoscope}
          acao={
            <Button type="button" onClick={() => setDraft(emptyDraft())}>
              Cadastrar
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: p.color || "#3b82f6" }}
                      aria-hidden
                    />
                    <p className="truncate font-semibold text-slate-900">
                      {p.name}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{p.specialty}</p>
                </div>
                <Badge tone={p.active ? "success" : "muted"}>
                  {p.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>

              {p.procedureNames.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {p.procedureIds.map((id, index) => {
                    const proc = procedures.find((item) => item.id === id);
                    const name = p.procedureNames[index] ?? proc?.name;
                    if (!name) return null;
                    const price = proc
                      ? resolveServicePrice(
                          proc.basePrice,
                          p.procedurePrices?.[id],
                        )
                      : null;
                    const custom = p.procedurePrices?.[id] != null;
                    return (
                      <li
                        key={id}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                      >
                        {name}
                        {price != null ? ` · ${formatBRL(price)}` : ""}
                        {custom ? " *" : ""}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  Sem tipos de atendimento vinculados
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  tamanho="sm"
                  variante="contorno"
                  onClick={() => setViewing(p)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  Visualizar
                </Button>
                <Button
                  type="button"
                  tamanho="sm"
                  variante="secundario"
                  onClick={() => setDraft(fromProfessional(p))}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Editar
                </Button>
                <Button
                  type="button"
                  tamanho="sm"
                  variante={p.active ? "perigo" : "secundario"}
                  onClick={() => void onToggleActive(p.id, !p.active)}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {p.active ? "Inativar" : "Ativar"}
                </Button>
              </div>
            </Card>
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
              <h2>Detalhes do profissional</h2>
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
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ background: viewing.color || "#3b82f6" }}
                      aria-hidden
                    />
                    <h3 className="service-view__name">{viewing.name}</h3>
                  </div>
                  <p className="service-view__code">{viewing.specialty}</p>
                </div>
                <div className="service-view__badges">
                  <Badge tone={viewing.active ? "success" : "muted"}>
                    {viewing.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <p className="service-view__desc">
                {viewing.notes?.trim()
                  ? viewing.notes
                  : "Sem observações cadastradas."}
              </p>

              <dl className="service-view__grid">
                <div>
                  <dt>Especialidade</dt>
                  <dd>{viewing.specialty}</dd>
                </div>
                <div>
                  <dt>Cor na agenda</dt>
                  <dd className="flex items-center gap-2">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-slate-200"
                      style={{ background: viewing.color || "#3b82f6" }}
                      aria-hidden
                    />
                    {viewing.color || "#3b82f6"}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{viewing.active ? "Ativo" : "Inativo"}</dd>
                </div>
                <div>
                  <dt>Atendimentos</dt>
                  <dd>
                    {viewing.procedureNames.length} tipo
                    {viewing.procedureNames.length === 1 ? "" : "s"}
                  </dd>
                </div>
              </dl>

              <div className="service-view__pros">
                <p className="service-view__pros-label">
                  Tipos de atendimento
                </p>
                {viewing.procedureNames.length > 0 ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {viewing.procedureIds.map((id, index) => {
                      const proc = procedures.find((item) => item.id === id);
                      const name = viewing.procedureNames[index] ?? proc?.name;
                      if (!name) return null;
                      const price = proc
                        ? resolveServicePrice(
                            proc.basePrice,
                            viewing.procedurePrices?.[id],
                          )
                        : null;
                      const custom = viewing.procedurePrices?.[id] != null;
                      return (
                        <li
                          key={id}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {name}
                          {price != null ? ` · ${formatBRL(price)}` : ""}
                          {custom ? " (preço próprio)" : ""}
                          {proc?.durationMinutes != null
                            ? ` · ${proc.durationMinutes} min`
                            : ""}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>Ainda sem tipo de atendimento vinculado</p>
                )}
              </div>

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
                    setDraft(fromProfessional(viewing));
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
          <Card className="agenda__modal-card">
            <div className="agenda__modal-head">
              <h2>
                {draft.id ? "Editar profissional" : "Novo profissional"}
              </h2>
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
                  placeholder="Ex.: Dra. Ana Souza"
                />
              </Campo>

              <Campo label="O que ele faz" obrigatorio>
                <Input
                  name="specialty"
                  required
                  value={draft.specialty}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, specialty: e.target.value } : prev,
                    )
                  }
                  placeholder="Ex.: Dermatologista, Esteticista, Ortodontista"
                />
              </Campo>

              <Campo
                label="Comissão %"
                dica="Percentual sobre o valor pago nas vendas deste profissional."
              >
                <Input
                  name="commissionPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={draft.commissionPercent}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, commissionPercent: e.target.value }
                        : prev,
                    )
                  }
                  placeholder="Ex.: 10"
                />
              </Campo>

              <Campo
                label="Tipos de atendimento (portfólio)"
                dica="O preço em branco usa o valor do catálogo. Preencha só se este profissional cobra diferente."
              >
                {procedures.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Cadastre serviços em Cadastros → Serviços para vinculá-los
                    ao portfólio.
                  </p>
                ) : (
                  <ul className="professional-portfolio">
                    {procedures.map((proc) => {
                      const checked = draft.procedureIds.includes(proc.id);
                      return (
                        <li
                          key={proc.id}
                          className={
                            checked
                              ? "professional-portfolio__item professional-portfolio__item--on"
                              : "professional-portfolio__item"
                          }
                        >
                          <label className="professional-portfolio__check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProcedure(proc.id)}
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{proc.name}</span>
                              <span className="professional-portfolio__meta">
                                Catálogo {formatBRL(proc.basePrice)}
                                {proc.durationMinutes != null
                                  ? ` · ${proc.durationMinutes} min`
                                  : ""}
                              </span>
                            </span>
                          </label>
                          {checked ? (
                            <div className="professional-portfolio__price">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                placeholder={String(proc.basePrice)}
                                aria-label={`Preço de ${proc.name} para este profissional`}
                                value={draft.procedurePrices[proc.id] ?? ""}
                                onChange={(e) =>
                                  setProcedurePrice(proc.id, e.target.value)
                                }
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Cor na agenda">
                  <Input
                    name="color"
                    type="color"
                    value={draft.color}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, color: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
                <Campo label="Status">
                  <Select
                    value={draft.active ? "true" : "false"}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, active: e.target.value === "true" }
                          : prev,
                      )
                    }
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </Select>
                </Campo>
              </div>

              <Campo label="Observações">
                <Textarea
                  name="notes"
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, notes: e.target.value } : prev,
                    )
                  }
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
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
