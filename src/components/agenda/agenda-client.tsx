"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import {
  Button,
  Campo,
  Card,
  EmptyState,
  Input,
  Label,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import {
  cancelAgendaEventAction,
  createAgendaEventAction,
  listAgendaWeekAction,
  searchAgendaPatientsAction,
  updateAgendaEventAction,
} from "@/app/agenda-actions";
import type { AgendaEventDTO } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";
import { resolveServicePrice } from "@/lib/professionals/price";

const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;
const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, i) => HOUR_START + i,
);
const HOUR_PX = 56;

type ProcedureOption = {
  id: string;
  name: string;
  basePrice: number;
  durationMinutes: number | null;
  validityDays: number | null;
  description: string | null;
};
type PatientOption = { id: string; fullName: string; phone: string };
type ProfessionalOption = {
  id: string;
  name: string;
  specialty: string;
  color: string | null;
  procedureIds: string[];
  procedurePrices: Record<string, number | null>;
};

type Props = {
  initialWeekStart: string;
  initialEvents: AgendaEventDTO[];
  procedures: ProcedureOption[];
  professionals: ProfessionalOption[];
};

function parseLocalDateInput(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateTimeLocalValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayHeader(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatSidebarWhen(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: AgendaEventDTO["status"]) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmado";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluído";
    case "CANCELLED":
      return "Cancelado";
    case "NO_SHOW":
      return "Não compareceu";
    default:
      return "Agendado";
  }
}

type Draft = {
  id?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  patientId: string;
  patientLabel: string;
  procedureId: string;
  professionalId: string;
  notes: string;
  status: AgendaEventDTO["status"];
};

function emptyDraft(slot?: Date): Draft {
  const start = slot ? new Date(slot) : new Date();
  start.setMinutes(0, 0, 0);
  if (!slot) start.setHours(Math.max(HOUR_START, start.getHours()));
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: "",
    startsAt: toDateTimeLocalValue(start),
    endsAt: toDateTimeLocalValue(end),
    patientId: "",
    patientLabel: "",
    procedureId: "",
    professionalId: "",
    notes: "",
    status: "SCHEDULED",
  };
}

function draftFromEvent(event: AgendaEventDTO): Draft {
  return {
    id: event.id,
    title: event.title,
    startsAt: toDateTimeLocalValue(new Date(event.startsAt)),
    endsAt: toDateTimeLocalValue(new Date(event.endsAt)),
    patientId: event.patientId ?? "",
    patientLabel: event.patientName ?? "",
    procedureId: event.procedureId ?? "",
    professionalId: event.professionalId ?? "",
    notes: event.notes ?? "",
    status: event.status,
  };
}

export function AgendaClient({
  initialWeekStart,
  initialEvents,
  procedures,
  professionals,
}: Props) {
  // Semana no fuso do browser — NÃO usar ISO UTC do SSR (Hostinger UTC desloca a semana no Brasil).
  const [weekStart, setWeekStart] = React.useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(initialWeekStart)) {
      return startOfWeek(parseLocalDateInput(initialWeekStart));
    }
    return startOfWeek(new Date());
  });
  const [events, setEvents] = React.useState(initialEvents);
  const [query, setQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(initialWeekStart)
      ? initialWeekStart
      : toDateInputValue(new Date()),
  );
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [patientHits, setPatientHits] = React.useState<PatientOption[]>([]);
  const today = React.useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const selectedProfessional = React.useMemo(
    () => professionals.find((p) => p.id === draft?.professionalId) ?? null,
    [professionals, draft?.professionalId],
  );

  const procedureOptions = React.useMemo(() => {
    if (!selectedProfessional || selectedProfessional.procedureIds.length === 0) {
      return procedures;
    }
    const allowed = new Set(selectedProfessional.procedureIds);
    return procedures.filter((p) => allowed.has(p.id));
  }, [procedures, selectedProfessional]);

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const reload = React.useCallback(
    async (anchor: Date, search?: string) => {
      const start = startOfWeek(anchor);
      const end = new Date(addDays(start, 7).getTime() - 1);
      setLoading(true);
      try {
        const data = await listAgendaWeekAction({
          from: start.toISOString(),
          to: end.toISOString(),
          query: search,
        });
        setWeekStart(start);
        setDateFilter(toDateInputValue(start));
        setEvents(data.events);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Falha ao carregar agenda",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Alinha a grade ao calendário local após o hydrate (corrige SSR em UTC).
  React.useEffect(() => {
    void reload(new Date());
  }, [reload]);

  async function onBuscar(e: React.FormEvent) {
    e.preventDefault();
    const anchor = dateFilter ? parseLocalDateInput(dateFilter) : weekStart;
    await reload(anchor, query);
  }

  function shiftWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setDateFilter(toDateInputValue(next));
    void reload(next, query);
  }

  function openCreate(day: Date, hour: number) {
    const slot = new Date(day);
    slot.setHours(hour, 0, 0, 0);
    setDraft(emptyDraft(slot));
    setPatientHits([]);
  }

  function openEdit(event: AgendaEventDTO) {
    setDraft(draftFromEvent(event));
    setPatientHits([]);
  }

  async function onPatientSearch(value: string) {
    setDraft((prev) =>
      prev ? { ...prev, patientLabel: value, patientId: "" } : prev,
    );
    if (value.trim().length < 2) {
      setPatientHits([]);
      return;
    }
    const hits = await searchAgendaPatientsAction(value);
    setPatientHits(hits);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    // datetime-local sem fuso: converte no browser para ISO absoluto.
    const starts = new Date(draft.startsAt);
    const ends = new Date(draft.endsAt);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      setSaving(false);
      toast.error("Data/hora inválida");
      return;
    }
    if (ends <= starts) {
      setSaving(false);
      toast.error("O horário final deve ser após o início");
      return;
    }
    fd.set("startsAt", starts.toISOString());
    fd.set("endsAt", ends.toISOString());
    try {
      if (draft.id) {
        await updateAgendaEventAction(draft.id, fd);
        toast.success("Compromisso atualizado");
      } else {
        await createAgendaEventAction(fd);
        toast.success("Compromisso criado");
      }
      setDraft(null);
      await reload(starts, query);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onCancelEvent() {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await cancelAgendaEventAction(draft.id);
      toast.success("Compromisso cancelado");
      setDraft(null);
      await reload(weekStart, query);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao cancelar",
      );
    } finally {
      setSaving(false);
    }
  }

  function eventStyle(event: AgendaEventDTO, day: Date) {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const dayStart = new Date(day);
    dayStart.setHours(HOUR_START, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(HOUR_END, 0, 0, 0);
    const clampedStart = start < dayStart ? dayStart : start;
    const clampedEnd = end > dayEnd ? dayEnd : end;
    const top =
      ((clampedStart.getHours() - HOUR_START) * 60 +
        clampedStart.getMinutes()) *
      (HOUR_PX / 60);
    const height = Math.max(
      24,
      ((clampedEnd.getTime() - clampedStart.getTime()) / 60000) *
        (HOUR_PX / 60),
    );
    return { top, height };
  }

  return (
    <div className="agenda">
      <Card className="agenda__filtros">
        <form onSubmit={onBuscar} className="agenda__filtros-form">
          <div>
            <Label htmlFor="agenda-q">Buscar por nome do evento...</Label>
            <Input
              id="agenda-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome do evento..."
            />
          </div>
          <div>
            <Label htmlFor="agenda-data">Data</Label>
            <Input
              id="agenda-data"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="agenda__filtros-acoes">
            <Button type="submit" disabled={loading}>
              Buscar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(emptyDraft());
                setPatientHits([]);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </div>
        </form>
      </Card>

      <div className="agenda__layout">
        <Card className="agenda__calendario">
          <div className="agenda__semana-nav">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => shiftWeek(-1)}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="agenda__semana-titulo">
              {formatDayHeader(days[0])} — {formatDayHeader(days[6])}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => shiftWeek(1)}
              aria-label="Próxima semana"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="agenda__grid-wrap">
            <div className="agenda__dias">
              <div className="agenda__corner" />
              {days.map((day, i) => {
                const isToday = sameDay(day, today);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "agenda__dia-head",
                      isToday && "agenda__dia-head--hoje",
                    )}
                  >
                    <span className="agenda__dia-nome">{DAY_LABELS[i]}</span>
                    <span
                      className={cn(
                        "agenda__dia-num",
                        isToday && "agenda__dia-num--hoje",
                      )}
                    >
                      {formatDayHeader(day)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="agenda__corpo">
              <div className="agenda__horas">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="agenda__hora"
                    style={{ height: HOUR_PX }}
                  >
                    {String(h).padStart(2, "0")}h
                  </div>
                ))}
              </div>

              <div className="agenda__colunas">
                {days.map((day) => {
                  const isToday = sameDay(day, today);
                  const dayEvents = events.filter((ev) =>
                    sameDay(new Date(ev.startsAt), day),
                  );
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "agenda__coluna",
                        isToday && "agenda__coluna--hoje",
                      )}
                    >
                      {HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className="agenda__slot"
                          style={{ height: HOUR_PX }}
                          onClick={() => openCreate(day, h)}
                          aria-label={`Agendar ${formatDayHeader(day)} às ${h}h`}
                        />
                      ))}
                      {dayEvents.map((ev) => {
                        const style = eventStyle(ev, day);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className="agenda__evento"
                            style={{
                              top: style.top,
                              height: style.height,
                              background: ev.color || undefined,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(ev);
                            }}
                            title={ev.title}
                          >
                            <span className="agenda__evento-hora">
                              {String(new Date(ev.startsAt).getHours()).padStart(
                                2,
                                "0",
                              )}
                              :
                              {String(
                                new Date(ev.startsAt).getMinutes(),
                              ).padStart(2, "0")}
                            </span>
                            <span className="agenda__evento-titulo">
                              {ev.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card className="agenda__sidebar">
          <h2 className="agenda__sidebar-titulo">Compromissos da semana</h2>
          {events.length === 0 ? (
            <EmptyState
              titulo="Nenhum compromisso"
              descricao="Use Buscar ou clique em um horário da grade para agendar."
              icone={CalendarDays}
            />
          ) : (
            <ul className="agenda__lista">
              {events.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    className="agenda__lista-item"
                    onClick={() => openEdit(ev)}
                  >
                    <span className="agenda__lista-dot" aria-hidden />
                    <span>
                      <span className="agenda__lista-quando">
                        {formatSidebarWhen(ev.startsAt)}
                      </span>{" "}
                      {ev.title}
                      {ev.patientName ? (
                        <span className="agenda__lista-paciente">
                          {" "}
                          · {ev.patientName}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
              <h2>{draft.id ? "Editar compromisso" : "Novo compromisso"}</h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraft(null)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={onSave} className="agenda__form">
              <Campo label="Título / evento" obrigatorio>
                <Input
                  name="title"
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, title: e.target.value } : prev,
                    )
                  }
                  placeholder="Ex.: reuniao de eventos"
                />
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Início" obrigatorio>
                  <Input
                    name="startsAt"
                    type="datetime-local"
                    required
                    value={draft.startsAt}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, startsAt: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
                <Campo label="Fim" obrigatorio>
                  <Input
                    name="endsAt"
                    type="datetime-local"
                    required
                    value={draft.endsAt}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, endsAt: e.target.value } : prev,
                      )
                    }
                  />
                </Campo>
              </div>

              <Campo label="Paciente">
                <Input
                  value={draft.patientLabel}
                  onChange={(e) => void onPatientSearch(e.target.value)}
                  placeholder="Buscar paciente por nome, CPF ou telefone"
                  autoComplete="off"
                />
                <input type="hidden" name="patientId" value={draft.patientId} />
                {patientHits.length > 0 ? (
                  <ul className="agenda__patient-hits">
                    {patientHits.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    patientId: p.id,
                                    patientLabel: p.fullName,
                                  }
                                : prev,
                            );
                            setPatientHits([]);
                          }}
                        >
                          {p.fullName}
                          <span>{p.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Campo>

              <div className="agenda__form-grid">
                <Campo label="Profissional">
                  <Select
                    name="professionalId"
                    value={draft.professionalId}
                    onChange={(e) => {
                      const professionalId = e.target.value;
                      const pro = professionals.find(
                        (p) => p.id === professionalId,
                      );
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const nextProcedure =
                          pro &&
                          prev.procedureId &&
                          pro.procedureIds.length > 0 &&
                          !pro.procedureIds.includes(prev.procedureId)
                            ? ""
                            : prev.procedureId;
                        return {
                          ...prev,
                          professionalId,
                          procedureId: nextProcedure,
                        };
                      });
                    }}
                  >
                    <option value="">—</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.specialty}
                      </option>
                    ))}
                  </Select>
                  {professionals.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Cadastre em Cadastros → Profissionais.
                    </p>
                  ) : null}
                </Campo>
                <Campo label="Status">
                  <Select
                    name="status"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target
                                .value as AgendaEventDTO["status"],
                            }
                          : prev,
                      )
                    }
                  >
                    {(
                      [
                        "SCHEDULED",
                        "CONFIRMED",
                        "IN_PROGRESS",
                        "COMPLETED",
                        "NO_SHOW",
                        "CANCELLED",
                      ] as const
                    ).map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </Select>
                </Campo>
              </div>

              <Campo label="Tipo de atendimento">
                <Select
                  name="procedureId"
                  value={draft.procedureId}
                  onChange={(e) => {
                    const procedureId = e.target.value;
                    const proc = procedures.find((p) => p.id === procedureId);
                    setDraft((prev) => {
                      if (!prev) return prev;
                      if (!proc?.durationMinutes) {
                        return { ...prev, procedureId };
                      }
                      const start = new Date(prev.startsAt);
                      if (Number.isNaN(start.getTime())) {
                        return { ...prev, procedureId };
                      }
                      const end = new Date(
                        start.getTime() + proc.durationMinutes * 60_000,
                      );
                      return {
                        ...prev,
                        procedureId,
                        endsAt: toDateTimeLocalValue(end),
                        title: prev.title.trim()
                          ? prev.title
                          : proc.name,
                      };
                    });
                  }}
                >
                  <option value="">—</option>
                  {procedureOptions.map((p) => {
                    const price = resolveServicePrice(
                      p.basePrice,
                      selectedProfessional?.procedurePrices?.[p.id],
                    );
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {` · ${formatBRL(price)}`}
                        {p.durationMinutes ? ` · ${p.durationMinutes}min` : ""}
                      </option>
                    );
                  })}
                </Select>
              </Campo>

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
                {draft.id ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={saving}
                    onClick={() => void onCancelEvent()}
                  >
                    Cancelar compromisso
                  </Button>
                ) : (
                  <span />
                )}
                <div className="agenda__form-acoes-right">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDraft(null)}
                  >
                    Fechar
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
