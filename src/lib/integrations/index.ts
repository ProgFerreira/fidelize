import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

export const apiCredentialSchema = z.object({
  name: z.string().min(2).max(80),
  environment: z.enum(["test", "live"]).default("live"),
  rateLimitRpm: z.coerce.number().int().min(1).max(1000).default(60),
});

export const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createApiCredential(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof apiCredentialSchema>;
}) {
  const data = apiCredentialSchema.parse(input.data);
  const raw = `fz_${data.environment}_${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, 12);
  const credential = await prisma.apiCredential.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      keyPrefix: prefix,
      keyHash: hashKey(raw),
      environment: data.environment,
      rateLimitRpm: data.rateLimitRpm,
      scopes: ["patients", "appointments", "credits", "balance", "points", "vouchers", "referrals", "nps"],
    },
  });
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "API_KEY_CHANGE",
    entityType: "ApiCredential",
    entityId: credential.id,
    afterData: { name: credential.name, prefix, environment: data.environment },
  });
  return { credential, rawKey: raw };
}

export async function revokeApiCredential(input: {
  clinicId: string;
  credentialId: string;
  actorId?: string;
}) {
  const credential = await prisma.apiCredential.update({
    where: { id: input.credentialId },
    data: { revokedAt: new Date() },
  });
  if (credential.clinicId !== input.clinicId) throw new Error("Credencial inválida");
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "API_KEY_CHANGE",
    entityType: "ApiCredential",
    entityId: credential.id,
    afterData: { revoked: true },
  });
  return credential;
}

export async function verifyApiKey(rawKey: string) {
  const prefix = rawKey.slice(0, 12);
  const candidates = await prisma.apiCredential.findMany({
    where: { keyPrefix: prefix, revokedAt: null },
  });
  const hash = hashKey(rawKey);
  const match = candidates.find((c) => c.keyHash === hash);
  if (!match) return null;

  const since = new Date(Date.now() - 60_000);
  const recent = await prisma.integrationLog.count({
    where: {
      clinicId: match.clinicId,
      direction: "IN",
      createdAt: { gte: since },
    },
  });
  if (recent >= match.rateLimitRpm) {
    return { ...match, rateLimited: true as const };
  }

  await prisma.apiCredential.update({
    where: { id: match.id },
    data: { lastUsedAt: new Date() },
  });
  return { ...match, rateLimited: false as const };
}

export async function reprocessDeadWebhooks(clinicId: string) {
  const dead = await prisma.webhookDelivery.findMany({
    where: {
      status: "DEAD",
      endpoint: { clinicId },
    },
    take: 50,
  });
  for (const d of dead) {
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: "PENDING",
        attempts: 0,
        nextRetryAt: null,
        lastError: null,
      },
    });
  }
  return processWebhookDeliveries(dead.length || 1);
}

export async function createWebhookEndpoint(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof webhookSchema>;
}) {
  const data = webhookSchema.parse(input.data);
  const secret = randomBytes(24).toString("hex");
  return prisma.webhookEndpoint.create({
    data: {
      clinicId: input.clinicId,
      url: data.url,
      secret,
      events: data.events,
    },
  });
}

export async function enqueueWebhook(input: {
  clinicId: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { clinicId: input.clinicId, active: true },
  });
  const deliveries = [];
  for (const endpoint of endpoints) {
    const events = endpoint.events as string[];
    if (!events.includes(input.eventType) && !events.includes("*")) continue;
    const delivery = await prisma.webhookDelivery.upsert({
      where: {
        endpointId_idempotencyKey: {
          endpointId: endpoint.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        endpointId: endpoint.id,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
        status: "PENDING",
      },
      update: {},
    });
    deliveries.push(delivery);
  }
  return deliveries;
}

export async function processWebhookDeliveries(limit = 20) {
  const pending = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    include: { endpoint: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const delivery of pending) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({
        id: delivery.id,
        type: delivery.eventType,
        created: timestamp,
        data: delivery.payload,
      });
      const signature = createHash("sha256")
        .update(`${timestamp}.${body}.${delivery.endpoint.secret}`)
        .digest("hex");

      const response = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fidelize-Timestamp": timestamp,
          "X-Fidelize-Signature": signature,
          "X-Idempotency-Key": delivery.idempotencyKey ?? delivery.id,
        },
        body,
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (response?.ok) {
        results.push(
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "DELIVERED",
              deliveredAt: new Date(),
              attempts: { increment: 1 },
            },
          }),
        );
        await writeAuditLog({
          clinicId: delivery.endpoint.clinicId,
          action: "WEBHOOK_DELIVERY",
          entityType: "WebhookDelivery",
          entityId: delivery.id,
          afterData: { status: "DELIVERED" },
        });
      } else {
        const attempts = delivery.attempts + 1;
        results.push(
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: attempts >= 5 ? "DEAD" : "FAILED",
              attempts,
              lastError: response
                ? `HTTP ${response.status}`
                : "Network error",
              nextRetryAt: new Date(Date.now() + attempts * 60_000),
            },
          }),
        );
      }
    } catch (error) {
      results.push(
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : "Erro",
            nextRetryAt: new Date(Date.now() + 60_000),
          },
        }),
      );
    }
  }
  return results;
}

export async function logIntegration(input: {
  clinicId: string;
  direction: "IN" | "OUT";
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  requestMeta?: Record<string, unknown>;
  responseMeta?: Record<string, unknown>;
  errorMessage?: string;
}) {
  // Nunca registrar tokens completos
  const scrub = (meta?: Record<string, unknown>) => {
    if (!meta) return undefined;
    const clone = { ...meta };
    for (const key of Object.keys(clone)) {
      if (/token|password|secret|authorization/i.test(key)) {
        clone[key] = "[redacted]";
      }
    }
    return clone;
  };

  return prisma.integrationLog.create({
    data: {
      clinicId: input.clinicId,
      direction: input.direction,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      requestMeta: scrub(input.requestMeta) as Prisma.InputJsonValue | undefined,
      responseMeta: scrub(input.responseMeta) as Prisma.InputJsonValue | undefined,
      errorMessage: input.errorMessage,
    },
  });
}

export async function listIntegrations(clinicId: string) {
  const [credentials, webhooks, logs] = await Promise.all([
    prisma.apiCredential.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookEndpoint.findMany({
      where: { clinicId },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.integrationLog.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return { credentials, webhooks, logs };
}
