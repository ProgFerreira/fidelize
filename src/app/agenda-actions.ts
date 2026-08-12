"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  cancelAgendaEvent,
  createAgendaEvent,
  listAgendaEvents,
  parseAgendaDateTime,
  scheduleEventSchema,
  searchPatientsForAgenda,
  updateAgendaEvent,
  weekBounds,
} from "@/lib/agenda";
import { prisma } from "@/lib/db";
import { toPlain } from "@/lib/serialize";

function revalidateAgenda() {
  revalidatePath("/agenda");
}

function formError(error: unknown): Error {
  if (error instanceof ZodError) {
    return new Error(error.issues[0]?.message ?? "Dados inválidos");
  }
  if (error instanceof Error) return error;
  return new Error("Não foi possível salvar");
}

function parseScheduleForm(formData: FormData) {
  const startsRaw = String(formData.get("startsAt") ?? "");
  const endsRaw = String(formData.get("endsAt") ?? "");
  return scheduleEventSchema.parse({
    title: formData.get("title"),
    startsAt: parseAgendaDateTime(startsRaw),
    endsAt: parseAgendaDateTime(endsRaw),
    patientId: String(formData.get("patientId") || "") || null,
    procedureId: String(formData.get("procedureId") || "") || null,
    professionalId: String(formData.get("professionalId") || "") || null,
    unitId: String(formData.get("unitId") || "") || null,
    professionalName: String(formData.get("professionalName") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    status: String(formData.get("status") || "SCHEDULED"),
  });
}

/**
 * Lista a semana pedida pelo client.
 * Prefira `from`/`to` em ISO (limites já calculados no fuso do browser).
 * `weekStart` como `YYYY-MM-DD` evita o deslocamento de `toISOString()` (UTC vs Brasil).
 */
export async function listAgendaWeekAction(input: {
  from?: string;
  to?: string;
  weekStart?: string;
  query?: string;
}) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);

  let start: Date;
  let end: Date;

  if (input.from && input.to) {
    start = new Date(input.from);
    end = new Date(input.to);
  } else if (input.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) {
    const [y, m, d] = input.weekStart.split("-").map(Number);
    const anchor = new Date(y, m - 1, d, 12, 0, 0, 0);
    ({ start, end } = weekBounds(anchor));
  } else if (input.weekStart) {
    const anchor = new Date(input.weekStart);
    ({ start, end } = weekBounds(anchor));
  } else {
    ({ start, end } = weekBounds(new Date()));
  }

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Data inválida");
  }

  const events = await listAgendaEvents({
    clinicId: session.clinicId,
    from: start,
    to: end,
    query: input.query,
  });
  return toPlain({
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    events,
  });
}

export async function createAgendaEventAction(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  try {
    const data = parseScheduleForm(formData);
    const event = await createAgendaEvent({
      clinicId: session.clinicId,
      actorId: session.user.id,
      unitId: session.unitId,
      data,
    });
    revalidateAgenda();
    return { ok: true as const, event: toPlain(event) };
  } catch (error) {
    throw formError(error);
  }
}

export async function updateAgendaEventAction(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  try {
    const data = parseScheduleForm(formData);
    const event = await updateAgendaEvent({
      clinicId: session.clinicId,
      actorId: session.user.id,
      id,
      data,
    });
    revalidateAgenda();
    return { ok: true as const, event: toPlain(event) };
  } catch (error) {
    throw formError(error);
  }
}

export async function cancelAgendaEventAction(id: string) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  await cancelAgendaEvent({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
  });
  revalidateAgenda();
  return { ok: true as const };
}

export async function searchAgendaPatientsAction(query: string) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  const patients = await searchPatientsForAgenda(session.clinicId, query);
  return toPlain(patients);
}

export async function listAgendaProceduresAction() {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  const procedures = await prisma.procedure.findMany({
    where: { clinicId: session.clinicId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return toPlain(procedures);
}
