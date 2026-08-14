import { prisma } from "@/lib/db";
import { cancelCommunicationsByKeys } from "@/lib/communications";
import { clinicPortalUrl, tryEnqueueWhatsApp } from "@/lib/whatsapp/enqueue";

const HOURS_24 = 24;
const HOURS_2 = 2;

export function appointmentReminderKeys(eventId: string) {
  return {
    h24: `appt-reminder-24h:${eventId}`,
    h2: `appt-reminder-2h:${eventId}`,
  };
}

export function returnReminderKeys(ref: string) {
  return {
    d30: `return-30:${ref}`,
    d7: `return-7:${ref}`,
    d1: `return-1:${ref}`,
  };
}

/** Se a consulta já passou, não envia. Se a janela já abriu, envia agora. */
export function reminderSendAt(
  startsAt: Date,
  hoursBefore: number,
  now = new Date(),
): Date | null {
  if (startsAt.getTime() <= now.getTime()) return null;
  const planned = new Date(startsAt.getTime() - hoursBefore * 60 * 60 * 1000);
  return planned.getTime() > now.getTime() ? planned : now;
}

export function returnReminderOffsets(intervaloDias: number) {
  return [30, 7, 1].filter((days) => days < intervaloDias);
}

function formatWhen(date: Date) {
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function enqueueAppointmentReminders(params: {
  clinicId: string;
  eventId: string;
  patientId: string | null;
  title: string;
  startsAt: Date;
  professionalName?: string | null;
}) {
  if (!params.patientId) return;
  const keys = appointmentReminderKeys(params.eventId);
  await cancelCommunicationsByKeys(params.clinicId, [keys.h24, keys.h2]);

  const when = formatWhen(params.startsAt);
  const pro = params.professionalName ? ` com ${params.professionalName}` : "";
  const agendar = clinicPortalUrl("/p/agendar");

  const h24 = reminderSendAt(params.startsAt, HOURS_24);
  if (h24) {
    await tryEnqueueWhatsApp({
      clinicId: params.clinicId,
      patientId: params.patientId,
      idempotencyKey: keys.h24,
      scheduledAt: h24,
      metadata: {
        kind: "APPT_REMINDER_24H",
        scheduleEventId: params.eventId,
      },
      body: `Olá! Lembrete: ${params.title}${pro} em ${when}. Responda SIM para confirmar ou NÃO para remarcar. ${agendar}`,
    });
  }

  const h2 = reminderSendAt(params.startsAt, HOURS_2);
  if (h2) {
    await tryEnqueueWhatsApp({
      clinicId: params.clinicId,
      patientId: params.patientId,
      idempotencyKey: keys.h2,
      scheduledAt: h2,
      metadata: {
        kind: "APPT_REMINDER_2H",
        scheduleEventId: params.eventId,
      },
      body: `Sua consulta ${params.title}${pro} é daqui a pouco (${when}). Responda SIM para confirmar ou NÃO para remarcar.`,
    });
  }
}

export async function cancelAppointmentReminders(
  clinicId: string,
  eventId: string,
) {
  const keys = appointmentReminderKeys(eventId);
  await cancelCommunicationsByKeys(clinicId, [keys.h24, keys.h2]);
}

export async function enqueueReturnReminders(params: {
  clinicId: string;
  patientId: string;
  procedureName: string;
  intervaloDias: number;
  completedAt: Date;
  ref: string;
}) {
  const offsets = returnReminderOffsets(params.intervaloDias);
  if (offsets.length === 0) return;

  const returnAt = new Date(params.completedAt);
  returnAt.setDate(returnAt.getDate() + params.intervaloDias);
  const keys = returnReminderKeys(params.ref);
  const keyByOffset: Record<number, string> = {
    30: keys.d30,
    7: keys.d7,
    1: keys.d1,
  };
  const agendar = clinicPortalUrl("/p/agendar");
  const now = new Date();

  for (const daysBefore of offsets) {
    const sendAt = new Date(returnAt);
    sendAt.setDate(sendAt.getDate() - daysBefore);
    if (sendAt.getTime() <= now.getTime()) continue;
    const when = formatWhen(returnAt);
    await tryEnqueueWhatsApp({
      clinicId: params.clinicId,
      patientId: params.patientId,
      idempotencyKey: keyByOffset[daysBefore],
      scheduledAt: sendAt,
      metadata: {
        kind: `RETURN_${daysBefore}D`,
        ref: params.ref,
      },
      body:
        daysBefore === 1
          ? `Amanhã é o retorno sugerido de ${params.procedureName} (${when}). Agende em ${agendar}`
          : `Está na hora do retorno de ${params.procedureName} (previsto para ${when}). Faltam ${daysBefore} dias. Agende em ${agendar}`,
    });
  }
}

export async function processAppointmentReminders(clinicId: string) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 26 * 60 * 60 * 1000);
  const events = await prisma.scheduleEvent.findMany({
    where: {
      clinicId,
      patientId: { not: null },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      startsAt: { gt: now, lte: horizon },
    },
    select: {
      id: true,
      patientId: true,
      title: true,
      startsAt: true,
      professionalName: true,
      professional: { select: { name: true } },
    },
    take: 80,
  });

  let enqueued = 0;
  for (const event of events) {
    await enqueueAppointmentReminders({
      clinicId,
      eventId: event.id,
      patientId: event.patientId,
      title: event.title,
      startsAt: event.startsAt,
      professionalName: event.professional?.name ?? event.professionalName,
    });
    enqueued += 1;
  }
  return enqueued;
}

const SIM_RE = /^(sim+|s|ok|confirmo|confirmar)$/i;
const NAO_RE = /^(n[aã]o+|n|remarcar|reagendar)$/i;

export function classifyWhatsAppReply(text: string): "SIM" | "NAO" | "SALDO" | null {
  const t = text.trim().toLowerCase();
  if (SIM_RE.test(t)) return "SIM";
  if (NAO_RE.test(t)) return "NAO";
  if (/\bsaldo\b/.test(t) || t === "extrato" || t === "pontos") return "SALDO";
  return null;
}

export async function handleAppointmentReply(params: {
  clinicId: string;
  patientId: string;
  kind: "SIM" | "NAO";
}) {
  const now = new Date();
  const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const event = await prisma.scheduleEvent.findFirst({
    where: {
      clinicId: params.clinicId,
      patientId: params.patientId,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      startsAt: { gte: now, lte: until },
    },
    orderBy: { startsAt: "asc" },
  });

  if (!event) {
    return {
      body: `Não encontramos consulta nos próximos dias. Para agendar: ${clinicPortalUrl("/p/agendar")}`,
    };
  }

  if (params.kind === "SIM") {
    if (event.status !== "CONFIRMED") {
      await prisma.scheduleEvent.update({
        where: { id: event.id },
        data: { status: "CONFIRMED" },
      });
    }
    return {
      body: `Consulta confirmada: ${event.title} em ${formatWhen(event.startsAt)}. Até breve!`,
    };
  }

  const note = [
    event.notes,
    `Paciente pediu remarcação via WhatsApp em ${now.toLocaleString("pt-BR")}.`,
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.scheduleEvent.update({
    where: { id: event.id },
    data: { notes: note },
  });

  return {
    body: `Sem problemas. Para remarcar ${event.title} (${formatWhen(event.startsAt)}), acesse ${clinicPortalUrl("/p/agendar")} ou fale com a recepção.`,
  };
}
