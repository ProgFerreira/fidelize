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
import { Stethoscope } from "lucide-react";
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
  procedureIds: string[];
};

function emptyDraft(): Draft {
  return {
    name: "",
    specialty: "",
    notes: "",
    active: true,
    color: "#3b82f6",
    procedureIds: [],
  };
}

function fromProfessional(p: ProfessionalDTO): Draft {
  return {
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    notes: p.notes ?? "",
    active: p.active,
    color: p.color || "#3b82f6",
    procedureIds: [...p.procedureIds],
  };
}

export function ProfessionalsClient({
  initialProfessionals,
  procedures,
}: Props) {
  const [items, setItems] = React.useState(initialProfessionals);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setItems(initialProfessionals);
  }, [initialProfessionals]);

  function toggleProcedure(id: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const has = prev.procedureIds.includes(id);
      return {
        ...prev,
        procedureIds: has
          ? prev.procedureIds.filter((x) => x !== id)
          : [...prev.procedureIds, id],
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
          Cadastre quem atende e os tipos de atendimento que realiza.
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
                  {p.procedureNames.map((name) => (
                    <li
                      key={name}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  Sem tipos de atendimento vinculados
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setDraft(fromProfessional(p))}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={p.active ? "danger" : "secondary"}
                  onClick={() => void onToggleActive(p.id, !p.active)}
                >
                  {p.active ? "Inativar" : "Ativar"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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

              <Campo label="Tipos de atendimento (portfólio)">
                {procedures.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Cadastre serviços em Cadastros → Serviços para vinculá-los
                    ao portfólio.
                  </p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-auto rounded-md border border-slate-200 p-3">
                    {procedures.map((proc) => {
                      const checked = draft.procedureIds.includes(proc.id);
                      return (
                        <li key={proc.id}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProcedure(proc.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{proc.name}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {formatBRL(proc.basePrice)}
                                {proc.durationMinutes != null
                                  ? ` · ${proc.durationMinutes} min`
                                  : ""}
                                {proc.validityDays != null
                                  ? ` · validade ${proc.validityDays}d`
                                  : ""}
                              </span>
                            </span>
                          </label>
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
    </div>
  );
}
