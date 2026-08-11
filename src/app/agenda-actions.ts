"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  cancelAgendaEvent,
  createAgendaEvent,
  listAgendaEvents,
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

export async function listAgendaWeekAction(input: {
  weekStart?: string;
  query?: string;
}) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  const anchor = input.weekStart ? new Date(input.weekStart) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    throw new Error("Data inválida");
  }
  const { start, end } = weekBounds(anchor);
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
  const data = scheduleEventSchema.parse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    patientId: String(formData.get("patientId") || "") || null,
    procedureId: String(formData.get("procedureId") || "") || null,
    professionalId: String(formData.get("professionalId") || "") || null,
    unitId: String(formData.get("unitId") || "") || null,
    professionalName: String(formData.get("professionalName") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    status: String(formData.get("status") || "SCHEDULED"),
  });

  const event = await createAgendaEvent({
    clinicId: session.clinicId,
    actorId: session.user.id,
    unitId: session.unitId,
    data,
  });
  revalidateAgenda();
  return { ok: true as const, event: toPlain(event) };
}

export async function updateAgendaEventAction(id: string, formData: FormData) {
  const session = await requirePermission(PERMISSIONS.AGENDA_MANAGE);
  const data = scheduleEventSchema.parse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    patientId: String(formData.get("patientId") || "") || null,
    procedureId: String(formData.get("procedureId") || "") || null,
    professionalId: String(formData.get("professionalId") || "") || null,
    unitId: String(formData.get("unitId") || "") || null,
    professionalName: String(formData.get("professionalName") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    status: String(formData.get("status") || "SCHEDULED"),
  });

  const event = await updateAgendaEvent({
    clinicId: session.clinicId,
    actorId: session.user.id,
    id,
    data,
  });
  revalidateAgenda();
  return { ok: true as const, event: toPlain(event) };
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
