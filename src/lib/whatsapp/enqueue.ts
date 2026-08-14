import { isModuleEnabled } from "@/lib/modules";
import { enqueueCommunication } from "@/lib/communications";
import { appBaseUrlFromEnv } from "@/lib/app-url";

export function clinicPortalUrl(path = "/p") {
  const base = appBaseUrlFromEnv() || "http://localhost:3000";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export async function canSendWhatsApp(clinicId: string) {
  return (
    (await isModuleEnabled(clinicId, "COMMUNICATIONS")) &&
    (await isModuleEnabled(clinicId, "WHATSAPP"))
  );
}

export async function tryEnqueueWhatsApp(input: {
  clinicId: string;
  patientId: string;
  body: string;
  idempotencyKey: string;
  scheduledAt?: Date | null;
  metadata?: Record<string, unknown>;
  variables?: Record<string, string | number>;
}) {
  if (!(await canSendWhatsApp(input.clinicId))) return null;
  try {
    return await enqueueCommunication({
      clinicId: input.clinicId,
      data: {
        patientId: input.patientId,
        channel: "WHATSAPP",
        purpose: "SERVICE",
        body: input.body,
        idempotencyKey: input.idempotencyKey,
        scheduledAt: input.scheduledAt ?? null,
        metadata: input.metadata,
        variables: input.variables,
      },
    });
  } catch {
    return null;
  }
}
