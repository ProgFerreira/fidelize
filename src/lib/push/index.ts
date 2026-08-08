import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule, isModuleEnabled } from "@/lib/modules";
import { dispatchProvider } from "@/lib/providers";

export const registerDeviceSchema = z.object({
  patientId: z.string().min(1),
  token: z.string().min(10).max(512),
  platform: z.enum(["ios", "android", "web"]),
  appId: z.string().max(120).optional().nullable(),
});

export async function registerPushDevice(input: {
  clinicId: string;
  data: z.infer<typeof registerDeviceSchema>;
}) {
  await requireModule(input.clinicId, "PUSH");
  const data = registerDeviceSchema.parse(input.data);
  const device = await prisma.pushDevice.upsert({
    where: {
      clinicId_token: { clinicId: input.clinicId, token: data.token },
    },
    create: {
      clinicId: input.clinicId,
      patientId: data.patientId,
      token: data.token,
      platform: data.platform,
      appId: data.appId ?? null,
      active: true,
      lastSeenAt: new Date(),
    },
    update: {
      patientId: data.patientId,
      platform: data.platform,
      appId: data.appId ?? null,
      active: true,
      lastSeenAt: new Date(),
    },
  });
  await writeAuditLog({
    clinicId: input.clinicId,
    action: "PUSH_DEVICE",
    entityType: "PushDevice",
    entityId: device.id,
    afterData: { platform: device.platform, patientId: device.patientId },
  });
  return device;
}

export async function unregisterPushDevice(input: {
  clinicId: string;
  token: string;
}) {
  return prisma.pushDevice.updateMany({
    where: { clinicId: input.clinicId, token: input.token },
    data: { active: false },
  });
}

export async function sendPushToPatient(input: {
  clinicId: string;
  patientId: string;
  title: string;
  body: string;
}) {
  if (!(await isModuleEnabled(input.clinicId, "PUSH"))) {
    return { sent: 0, results: [] as Awaited<ReturnType<typeof dispatchProvider>>[] };
  }
  const devices = await prisma.pushDevice.findMany({
    where: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      active: true,
    },
  });
  const results = [];
  for (const device of devices) {
    results.push(
      await dispatchProvider({
        clinicId: input.clinicId,
        channel: "PUSH",
        to: device.token,
        subject: input.title,
        body: input.body,
        metadata: { patientId: input.patientId, platform: device.platform },
      }),
    );
  }
  return { sent: results.filter((r) => r.ok).length, results };
}

export async function listPushDevices(clinicId: string) {
  return prisma.pushDevice.findMany({
    where: { clinicId, active: true },
    include: { patient: { select: { id: true, fullName: true, phone: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export function deviceTokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}
