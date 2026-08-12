import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { organizacaoAtual } from "@/lib/tenant";
import type { Prisma, ScheduleEventStatus } from "@/generated/prisma/client";

export const scheduleEventSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título").max(120),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    patientId: z.string().trim().min(1).optional().nullable(),
    procedureId: z.string().trim().min(1).optional().nullable(),
    professionalId: z.string().trim().min(1).optional().nullable(),
    unitId: z.string().trim().min(1).optional().nullable(),
    professionalName: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z
      .enum([
        "SCHEDULED",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
      ])
      .default("SCHEDULED"),
    color: z.string().trim().max(32).optional().nullable(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "O horário final deve ser após o início",
    path: ["endsAt"],
  });

export type ScheduleEventInput = z.infer<typeof scheduleEventSchema>;

export type AgendaEventDTO = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: ScheduleEventStatus;
  professionalId: string | null;
  professionalName: string | null;
  professionalSpecialty: string | null;
  notes: string | null;
  color: string | null;
  patientId: string | null;
  patientName: string | null;
  procedureId: string | null;
  procedureName: string | null;
  unitId: string | null;
};

const eventInclude = {
  patient: { select: { id: true, fullName: true } },
  procedure: { select: { id: true, name: true } },
  professional: { select: { id: true, name: true, specialty: true, color: true } },
} satisfies Prisma.ScheduleEventInclude;

function toDTO(
  event: Prisma.ScheduleEventGetPayload<{ include: typeof eventInclude }>,
): AgendaEventDTO {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: event.status,
    professionalId: event.professionalId,
    professionalName: event.professional?.name ?? event.professionalName,
    professionalSpecialty: event.professional?.specialty ?? null,
    notes: event.notes,
    color: event.color || event.professional?.color || null,
    patientId: event.patientId,
    patientName: event.patient?.fullName ?? null,
    procedureId: event.procedureId,
    procedureName: event.procedure?.name ?? null,
    unitId: event.unitId,
  };
}

/** Domingo 00:00 local → sábado 23:59:59.999 da semana que contém `anchor`. */
export function weekBounds(anchor: Date) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start, end };
}

/** `YYYY-MM-DD` no calendário local (sem deslocar por fuso via toISOString). */
export function toDateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Interpreta `YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm` como relógio de parede em UTC
 * (evita o bug de `new Date("2026-08-12T14:00")` no Node UTC vs browser local).
 * Prefira enviar ISO com Z a partir do client; este parser é fallback.
 */
export function parseAgendaDateTime(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) return new Date(Number.NaN);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    trimmed,
  );
  if (!m) return new Date(trimmed);
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4] ?? 0);
  const minute = Number(m[5] ?? 0);
  const second = Number(m[6] ?? 0);
  return new Date(year, month, day, hour, minute, second, 0);
}

export async function listAgendaEvents(params: {
  clinicId: string;
  from: Date;
  to: Date;
  query?: string;
  statuses?: ScheduleEventStatus[];
}) {
  const q = params.query?.trim();
  const events = await prisma.scheduleEvent.findMany({
    where: {
      clinicId: params.clinicId,
      startsAt: { lte: params.to },
      endsAt: { gte: params.from },
      ...(params.statuses?.length
        ? { status: { in: params.statuses } }
        : { status: { not: "CANCELLED" } }),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { professionalName: { contains: q } },
              { professional: { name: { contains: q } } },
              { patient: { fullName: { contains: q } } },
              { notes: { contains: q } },
            ],
          }
        : {}),
    },
    include: eventInclude,
    orderBy: { startsAt: "asc" },
  });
  return events.map(toDTO);
}

export async function getAgendaEvent(clinicId: string, id: string) {
  const event = await prisma.scheduleEvent.findFirst({
    where: { id, clinicId },
    include: eventInclude,
  });
  return event ? toDTO(event) : null;
}

async function assertRefs(params: {
  clinicId: string;
  patientId?: string | null;
  procedureId?: string | null;
  professionalId?: string | null;
  unitId?: string | null;
}) {
  if (params.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: params.patientId, clinicId: params.clinicId },
      select: { id: true },
    });
    if (!patient) throw new Error("Paciente não encontrado");
  }
  if (params.procedureId) {
    const procedure = await prisma.procedure.findFirst({
      where: { id: params.procedureId, clinicId: params.clinicId },
      select: { id: true },
    });
    if (!procedure) throw new Error("Procedimento não encontrado");
  }
  if (params.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: params.unitId, clinicId: params.clinicId },
      select: { id: true },
    });
    if (!unit) throw new Error("Unidade não encontrada");
  }

  if (!params.professionalId) return null;

  const professional = await prisma.professional.findFirst({
    where: {
      id: params.professionalId,
      clinicId: params.clinicId,
    },
    select: { id: true, name: true, color: true },
  });
  if (!professional) throw new Error("Profissional não encontrado");
  return professional;
}

export async function createAgendaEvent(params: {
  clinicId: string;
  actorId: string;
  unitId?: string | null;
  data: ScheduleEventInput;
}) {
  const data = scheduleEventSchema.parse(params.data);
  const professional = await assertRefs({
    clinicId: params.clinicId,
    patientId: data.patientId,
    procedureId: data.procedureId,
    professionalId: data.professionalId,
    unitId: data.unitId ?? params.unitId,
  });

  const event = await prisma.scheduleEvent.create({
    data: {
      organizationId: organizacaoAtual(),
      clinicId: params.clinicId,
      unitId: data.unitId ?? params.unitId ?? null,
      patientId: data.patientId || null,
      procedureId: data.procedureId || null,
      professionalId: data.professionalId || null,
      createdById: params.actorId,
      title: data.title,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: data.status,
      professionalName:
        professional?.name || data.professionalName || null,
      notes: data.notes || null,
      color: data.color || professional?.color || null,
    },
    include: eventInclude,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "SCHEDULE_CHANGE",
    entityType: "ScheduleEvent",
    entityId: event.id,
    afterData: {
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      status: event.status,
    },
  });

  return toDTO(event);
}

export async function updateAgendaEvent(params: {
  clinicId: string;
  actorId: string;
  id: string;
  data: Partial<ScheduleEventInput>;
}) {
  const existing = await prisma.scheduleEvent.findFirst({
    where: { id: params.id, clinicId: params.clinicId },
  });
  if (!existing) throw new Error("Compromisso não encontrado");

  const merged = scheduleEventSchema.parse({
    title: params.data.title ?? existing.title,
    startsAt: params.data.startsAt ?? existing.startsAt,
    endsAt: params.data.endsAt ?? existing.endsAt,
    patientId:
      params.data.patientId !== undefined
        ? params.data.patientId
        : existing.patientId,
    procedureId:
      params.data.procedureId !== undefined
        ? params.data.procedureId
        : existing.procedureId,
    professionalId:
      params.data.professionalId !== undefined
        ? params.data.professionalId
        : existing.professionalId,
    unitId:
      params.data.unitId !== undefined ? params.data.unitId : existing.unitId,
    professionalName:
      params.data.professionalName !== undefined
        ? params.data.professionalName
        : existing.professionalName,
    notes: params.data.notes !== undefined ? params.data.notes : existing.notes,
    status: params.data.status ?? existing.status,
    color: params.data.color !== undefined ? params.data.color : existing.color,
  });

  const professional = await assertRefs({
    clinicId: params.clinicId,
    patientId: merged.patientId,
    procedureId: merged.procedureId,
    professionalId: merged.professionalId,
    unitId: merged.unitId,
  });

  const event = await prisma.scheduleEvent.update({
    where: { id: existing.id },
    data: {
      title: merged.title,
      startsAt: merged.startsAt,
      endsAt: merged.endsAt,
      patientId: merged.patientId || null,
      procedureId: merged.procedureId || null,
      professionalId: merged.professionalId || null,
      unitId: merged.unitId || null,
      professionalName:
        professional?.name || merged.professionalName || null,
      notes: merged.notes || null,
      status: merged.status,
      color: merged.color || professional?.color || null,
    },
    include: eventInclude,
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "SCHEDULE_CHANGE",
    entityType: "ScheduleEvent",
    entityId: event.id,
    beforeData: {
      title: existing.title,
      startsAt: existing.startsAt.toISOString(),
      status: existing.status,
    },
    afterData: {
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      status: event.status,
    },
  });

  return toDTO(event);
}

export async function cancelAgendaEvent(params: {
  clinicId: string;
  actorId: string;
  id: string;
}) {
  return updateAgendaEvent({
    clinicId: params.clinicId,
    actorId: params.actorId,
    id: params.id,
    data: { status: "CANCELLED" },
  });
}

export function searchPatientsForAgenda(clinicId: string, q: string) {
  const query = q.trim();
  if (query.length < 2) return Promise.resolve([]);
  return prisma.patient.findMany({
    where: {
      clinicId,
      status: "ACTIVE",
      OR: [
        { fullName: { contains: query } },
        { cpf: { contains: query.replace(/\D/g, "") } },
        { phone: { contains: query.replace(/\D/g, "") } },
      ],
    },
    select: { id: true, fullName: true, phone: true },
    take: 12,
    orderBy: { fullName: "asc" },
  });
}
