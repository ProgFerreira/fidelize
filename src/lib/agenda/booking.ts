import { prisma } from "@/lib/db";
import {
  createAgendaEvent,
  listAgendaEvents,
} from "@/lib/agenda";
import { tryEnqueueWhatsApp } from "@/lib/whatsapp/enqueue";

const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;

export type BookingSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
};

export type BookingCatalog = {
  professionals: Array<{
    id: string;
    name: string;
    specialty: string;
    procedureIds: string[];
  }>;
  procedures: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    basePrice: number;
    professionalIds: string[];
  }>;
};

export async function getPatientBookingCatalog(clinicId: string): Promise<BookingCatalog> {
  const [professionals, procedures] = await Promise.all([
    prisma.professional.findMany({
      where: { clinicId, active: true },
      include: {
        procedures: { select: { procedureId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.procedure.findMany({
      where: { clinicId, active: true },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        basePrice: true,
        professionalLinks: { select: { professionalId: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    professionals: professionals.map((p) => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty,
      procedureIds: p.procedures.map((l) => l.procedureId),
    })),
    procedures: procedures.map((p) => ({
      id: p.id,
      name: p.name,
      durationMinutes: p.durationMinutes ?? 60,
      basePrice: Number(p.basePrice),
      professionalIds: p.professionalLinks.map((l) => l.professionalId),
    })),
  };
}

function slotLabel(startsAt: Date) {
  return startsAt.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function listPatientAvailableSlots(params: {
  clinicId: string;
  professionalId: string;
  procedureId: string;
  days?: number;
}) {
  const procedure = await prisma.procedure.findFirst({
    where: { id: params.procedureId, clinicId: params.clinicId, active: true },
    select: { id: true, durationMinutes: true, name: true },
  });
  if (!procedure) throw new Error("Serviço não encontrado");

  const professional = await prisma.professional.findFirst({
    where: {
      id: params.professionalId,
      clinicId: params.clinicId,
      active: true,
      procedures: { some: { procedureId: params.procedureId } },
    },
    select: { id: true },
  });
  if (!professional) throw new Error("Profissional não atende este serviço");

  const duration = procedure.durationMinutes ?? 60;
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + (params.days ?? 14));

  const events = await listAgendaEvents({
    clinicId: params.clinicId,
    from,
    to,
  });
  const busy = events.filter(
    (e) =>
      e.professionalId === params.professionalId &&
      e.status !== "CANCELLED" &&
      e.status !== "NO_SHOW",
  );

  const slots: BookingSlot[] = [];
  for (let day = 0; day < (params.days ?? 14); day += 1) {
    const cursor = new Date(from);
    cursor.setDate(from.getDate() + day);
    const weekday = cursor.getDay();
    if (weekday === 0) continue;
    if (weekday === 6 && cursor.getHours() >= 12) continue;

    const closeHour = weekday === 6 ? 12 : CLOSE_HOUR;
    for (let hour = OPEN_HOUR; hour < closeHour; hour += 1) {
      for (const minute of [0, 30]) {
        const startsAt = new Date(cursor);
        startsAt.setHours(hour, minute, 0, 0);
        if (startsAt.getTime() <= now.getTime() + 60 * 60 * 1000) continue;
        const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
        if (endsAt.getHours() > closeHour || (endsAt.getHours() === closeHour && endsAt.getMinutes() > 0)) {
          continue;
        }
        const clash = busy.some((e) => {
          const s = new Date(e.startsAt).getTime();
          const t = new Date(e.endsAt).getTime();
          return s < endsAt.getTime() && t > startsAt.getTime();
        });
        if (clash) continue;
        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          label: slotLabel(startsAt),
        });
      }
    }
  }

  return slots.slice(0, 48);
}

export async function createPatientBooking(params: {
  clinicId: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  procedureId: string;
  startsAt: Date;
  depositMethod?: "PIX" | "CASHBACK" | null;
  depositAmount?: number;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, clinicId: params.clinicId },
    select: { bookingBlockedUntil: true },
  });
  if (patient?.bookingBlockedUntil && patient.bookingBlockedUntil > new Date()) {
    throw new Error(
      `Agendamento bloqueado até ${patient.bookingBlockedUntil.toLocaleDateString("pt-BR")} por falta anterior.`,
    );
  }
  const [procedure, professional] = await Promise.all([
    prisma.procedure.findFirst({
      where: { id: params.procedureId, clinicId: params.clinicId, active: true },
      select: { id: true, name: true, durationMinutes: true },
    }),
    prisma.professional.findFirst({
      where: {
        id: params.professionalId,
        clinicId: params.clinicId,
        active: true,
        procedures: { some: { procedureId: params.procedureId } },
      },
      select: { id: true, name: true },
    }),
  ]);
  if (!procedure) throw new Error("Serviço não encontrado");
  if (!professional) throw new Error("Profissional não atende este serviço");

  const duration = procedure.durationMinutes ?? 60;
  const endsAt = new Date(params.startsAt.getTime() + duration * 60 * 1000);
  if (params.startsAt.getTime() <= Date.now()) {
    throw new Error("Escolha um horário futuro");
  }

  const clash = await prisma.scheduleEvent.findFirst({
    where: {
      clinicId: params.clinicId,
      professionalId: professional.id,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: params.startsAt },
    },
    select: { id: true },
  });
  if (clash) throw new Error("Este horário acabou de ser ocupado. Escolha outro.");

  const event = await createAgendaEvent({
    clinicId: params.clinicId,
    data: {
      title: procedure.name,
      startsAt: params.startsAt,
      endsAt,
      patientId: params.patientId,
      procedureId: procedure.id,
      professionalId: professional.id,
      professionalName: professional.name,
      status: "SCHEDULED",
      notes: `Agendado pelo paciente ${params.patientName} no portal.`,
    },
  });

  await tryEnqueueWhatsApp({
    clinicId: params.clinicId,
    patientId: params.patientId,
    idempotencyKey: `appt-booked:${event.id}`,
    body: `Agendamento recebido: ${procedure.name} com ${professional.name} em ${slotLabel(params.startsAt)}. Responda SIM para confirmar ou NÃO para remarcar.`,
    metadata: { kind: "APPT_BOOKED", scheduleEventId: event.id },
  });

  if (params.depositMethod && params.depositAmount && params.depositAmount > 0) {
    const { applyBookingDeposit } = await import("@/lib/agenda/deposit");
    await applyBookingDeposit({
      clinicId: params.clinicId,
      eventId: event.id,
      patientId: params.patientId,
      method: params.depositMethod,
      amount: params.depositAmount,
    });
  }

  return event;
}
