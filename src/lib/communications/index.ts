import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule, isModuleEnabled } from "@/lib/modules";
import { hasMarketingConsent } from "@/lib/consent";
import { renderTemplate } from "@/lib/templates";
import type {
  CommunicationChannel,
  CommunicationStatus,
  ConsentPurpose,
} from "@/generated/prisma/client";

export const enqueueSchema = z.object({
  patientId: z.string().min(1),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "PUSH", "INTERNAL"]),
  purpose: z
    .enum(["TRANSACTIONAL", "SERVICE", "MARKETING", "SURVEY", "REFERRAL"])
    .default("SERVICE"),
  templateId: z.string().optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(5000),
  toAddress: z.string().max(200).optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  automationId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  variables: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  estimatedCost: z.number().optional().nullable(),
});

const CHANNEL_MODULE: Record<CommunicationChannel, Parameters<typeof isModuleEnabled>[1] | null> = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  SMS: "SMS",
  PUSH: "PUSH",
  INTERNAL: null,
};

type QuietHours = { start: string; end: string };

async function getCommSettings(clinicId: string) {
  const setting = await prisma.setting.findUnique({
    where: { clinicId_key: { clinicId, key: "communications.policy" } },
  });
  const value = (setting?.value as Record<string, unknown> | null) ?? {};
  return {
    quietHours: (value.quietHours as QuietHours | undefined) ?? {
      start: "21:00",
      end: "08:00",
    },
    maxPerPatientPerDay: Number(value.maxPerPatientPerDay ?? 5),
  };
}

function isInQuietHours(quiet: QuietHours, at = new Date()) {
  const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  if (quiet.start <= quiet.end) {
    return hhmm >= quiet.start && hhmm < quiet.end;
  }
  // atravessa meia-noite
  return hhmm >= quiet.start || hhmm < quiet.end;
}

function nextQuietEnd(quiet: QuietHours, from = new Date()) {
  const [eh, em] = quiet.end.split(":").map(Number);
  const next = new Date(from);
  next.setHours(eh, em, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  return next;
}

export async function enqueueCommunication(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof enqueueSchema>;
}) {
  await requireModule(input.clinicId, "COMMUNICATIONS");
  const data = enqueueSchema.parse(input.data);
  const channel = data.channel as CommunicationChannel;

  const channelModule = CHANNEL_MODULE[channel];
  if (channelModule && !(await isModuleEnabled(input.clinicId, channelModule))) {
    throw new Error(`Canal ${channel} desativado`);
  }

  if (data.idempotencyKey) {
    const existing = await prisma.communication.findUnique({
      where: {
        clinicId_idempotencyKey: {
          clinicId: input.clinicId,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
  }

  if (data.purpose === "MARKETING") {
    const ok = await hasMarketingConsent(input.clinicId, data.patientId, channel);
    if (!ok) {
      const blocked = await prisma.communication.create({
        data: {
          clinicId: input.clinicId,
          patientId: data.patientId,
          channel,
          purpose: data.purpose as ConsentPurpose,
          status: "BLOCKED_CONSENT",
          subject: data.subject ?? null,
          body: data.body,
          toAddress: data.toAddress ?? null,
          templateId: data.templateId ?? null,
          campaignId: data.campaignId ?? null,
          automationId: data.automationId ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          optOut: true,
        },
      });
      return blocked;
    }
  }

  const policy = await getCommSettings(input.clinicId);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.communication.count({
    where: {
      clinicId: input.clinicId,
      patientId: data.patientId,
      createdAt: { gte: dayStart },
      status: { notIn: ["CANCELLED", "BLOCKED_CONSENT", "DRAFT"] },
    },
  });
  if (sentToday >= policy.maxPerPatientPerDay && data.purpose === "MARKETING") {
    return prisma.communication.create({
      data: {
        clinicId: input.clinicId,
        patientId: data.patientId,
        channel,
        purpose: data.purpose as ConsentPurpose,
        status: "CANCELLED",
        subject: data.subject ?? null,
        body: data.body,
        errorReason: "RATE_LIMIT",
        errorMessage: "Limite diário de mensagens atingido",
        idempotencyKey: data.idempotencyKey ?? null,
      },
    });
  }

  const body = data.variables
    ? renderTemplate(data.body, data.variables)
    : data.body;

  let scheduledAt = data.scheduledAt ?? null;
  if (
    !scheduledAt &&
    data.purpose === "MARKETING" &&
    channel !== "INTERNAL" &&
    isInQuietHours(policy.quietHours)
  ) {
    scheduledAt = nextQuietEnd(policy.quietHours);
  }

  const status: CommunicationStatus = scheduledAt ? "SCHEDULED" : "QUEUED";

  const communication = await prisma.communication.create({
    data: {
      clinicId: input.clinicId,
      patientId: data.patientId,
      channel,
      purpose: data.purpose as ConsentPurpose,
      status,
      subject: data.subject ?? null,
      body,
      toAddress: data.toAddress ?? null,
      templateId: data.templateId ?? null,
      campaignId: data.campaignId ?? null,
      automationId: data.automationId ?? null,
      scheduledAt,
      idempotencyKey: data.idempotencyKey ?? null,
      metadata: data.metadata ?? undefined,
      estimatedCost:
        data.estimatedCost != null ? String(data.estimatedCost) : null,
    },
  });

  await prisma.communicationEvent.create({
    data: {
      communicationId: communication.id,
      eventType: "CREATED",
      payload: { status, scheduledAt },
    },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "COMMUNICATION_SEND",
    entityType: "Communication",
    entityId: communication.id,
    afterData: { channel, status, patientId: data.patientId },
  });

  return communication;
}

export async function enqueueTestMessage(input: {
  clinicId: string;
  actorId?: string;
  patientId: string;
  channel: CommunicationChannel;
  body: string;
}) {
  return enqueueCommunication({
    clinicId: input.clinicId,
    actorId: input.actorId,
    data: {
      patientId: input.patientId,
      channel: input.channel,
      purpose: "SERVICE",
      body: `[TESTE] ${input.body}`,
      idempotencyKey: `test:${input.patientId}:${Date.now()}`,
    },
  });
}

/** Processa fila usando adapters reais (Resend/Twilio/Meta/FCM) com fallback simulado */
export async function processCommunicationQueue(clinicId?: string, limit = 50) {
  const { dispatchProvider } = await import("@/lib/providers");
  const { sendPushToPatient } = await import("@/lib/push");

  const items = await prisma.communication.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      status: { in: ["QUEUED", "SCHEDULED"] },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    include: {
      patient: { select: { id: true, phone: true, email: true, fullName: true } },
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const item of items) {
    if (item.purpose === "MARKETING" && item.channel !== "INTERNAL") {
      const policy = await getCommSettings(item.clinicId);
      if (isInQuietHours(policy.quietHours)) {
        await prisma.communication.update({
          where: { id: item.id },
          data: {
            status: "SCHEDULED",
            scheduledAt: nextQuietEnd(policy.quietHours),
          },
        });
        continue;
      }
    }

    if (item.channel === "INTERNAL") {
      const updated = await prisma.communication.update({
        where: { id: item.id },
        data: {
          status: "DELIVERED",
          sentAt: new Date(),
          deliveredAt: new Date(),
          providerId: `internal_${item.id.slice(0, 8)}`,
        },
      });
      await prisma.communicationEvent.create({
        data: {
          communicationId: item.id,
          eventType: "DELIVERED",
          payload: { channel: "INTERNAL" },
        },
      });
      results.push(updated);
      continue;
    }

    if (item.channel === "PUSH" && item.patientId) {
      const push = await sendPushToPatient({
        clinicId: item.clinicId,
        patientId: item.patientId,
        title: item.subject || "Clube de Benefícios",
        body: item.body,
      });
      const ok = push.sent > 0;
      const updated = await prisma.communication.update({
        where: { id: item.id },
        data: {
          status: ok ? "SENT" : "FAILED",
          sentAt: ok ? new Date() : null,
          failedAt: ok ? null : new Date(),
          errorMessage: ok ? null : "Nenhum device push ativo",
          providerId: push.results[0]?.providerId ?? null,
          deliveredAt: ok && push.results[0]?.delivered ? new Date() : null,
        },
      });
      await prisma.communicationEvent.create({
        data: {
          communicationId: item.id,
          eventType: ok ? "SENT" : "FAILED",
          payload: { push },
        },
      });
      results.push(updated);
      continue;
    }

    const to =
      item.toAddress ||
      (item.channel === "EMAIL"
        ? item.patient?.email
        : item.patient?.phone) ||
      "";

    if (!to) {
      const failed = await prisma.communication.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorReason: "NO_ADDRESS",
          errorMessage: "Destinatário sem telefone/e-mail",
        },
      });
      results.push(failed);
      continue;
    }

    const send = await dispatchProvider({
      clinicId: item.clinicId,
      channel: item.channel as "WHATSAPP" | "EMAIL" | "SMS" | "PUSH",
      to,
      subject: item.subject,
      body: item.body,
    });

    const updated = await prisma.communication.update({
      where: { id: item.id },
      data: {
        status: send.ok ? "SENT" : "FAILED",
        sentAt: send.ok ? new Date() : null,
        deliveredAt: send.ok && send.delivered ? new Date() : null,
        failedAt: send.ok ? null : new Date(),
        providerId: send.providerId ?? null,
        errorMessage: send.error ?? null,
        errorReason: send.ok ? null : "PROVIDER_ERROR",
        metadata: {
          ...((item.metadata as Record<string, unknown> | null) ?? {}),
          provider: send.provider,
          simulated: send.simulated,
        },
      },
    });
    await prisma.communicationEvent.create({
      data: {
        communicationId: item.id,
        eventType: send.ok ? "SENT" : "FAILED",
        payload: send,
      },
    });
    if (send.ok && send.delivered) {
      await prisma.communicationEvent.create({
        data: {
          communicationId: item.id,
          eventType: "DELIVERED",
          payload: { provider: send.provider, simulated: send.simulated },
        },
      });
    }
    results.push(updated);
  }
  return results;
}

export async function cancelQueuedForPatient(clinicId: string, patientId: string) {
  return prisma.communication.updateMany({
    where: {
      clinicId,
      patientId,
      status: { in: ["QUEUED", "SCHEDULED"] },
      purpose: "MARKETING",
    },
    data: { status: "CANCELLED", errorReason: "RECOVERED" },
  });
}

export async function listCommunications(
  clinicId: string,
  opts?: { status?: CommunicationStatus; channel?: CommunicationChannel },
) {
  return prisma.communication.findMany({
    where: {
      clinicId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.channel ? { channel: opts.channel } : {}),
    },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      template: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function cancelCommunicationsByKeys(
  clinicId: string,
  keys: string[],
) {
  if (keys.length === 0) return { count: 0 };
  return prisma.communication.updateMany({
    where: {
      clinicId,
      idempotencyKey: { in: keys },
      status: { in: ["QUEUED", "SCHEDULED"] },
    },
    data: { status: "CANCELLED", errorReason: "RESCHEDULED" },
  });
}
