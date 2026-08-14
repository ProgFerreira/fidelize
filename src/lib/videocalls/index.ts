import { z } from "zod";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getPatientSession } from "@/lib/otp/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import type {
  Prisma,
  VideoCallParticipantRole,
  VideoCallStatus,
} from "@/generated/prisma/client";

export type VideoCallCaller =
  | { clinicId: string; role: "PROFISSIONAL"; userId: string }
  | { clinicId: string; role: "PACIENTE"; patientId: string };

/** Sala liga-se a uma clínica só depois de resolvida a organização dona dela. */
async function resolveClinicOrganizationId(clinicId: string) {
  const clinic = await semOrganizacao(() =>
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) throw new Error("Clínica inválida");
  return clinic.organizationId;
}

/**
 * Estabelece o contexto de organização a partir da clínica antes de rodar `fn`.
 * Necessário em rotas do portal do paciente — a sessão OTP só carrega
 * `clinicId`, então nenhum contexto de tenant existe até isto rodar.
 */
export async function withClinicOrg<T>(
  clinicId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const organizationId = await resolveClinicOrganizationId(clinicId);
  return comOrganizacao({ organizationId }, fn);
}

/**
 * Identifica quem está chamando a rota — profissional (sessão staff) ou
 * paciente (sessão OTP do portal). Não redireciona: rota de API consumida por
 * polling do client, precisa devolver JSON mesmo sem sessão.
 */
export async function identifyVideoCallCaller(): Promise<VideoCallCaller | null> {
  const staff = await auth();
  if (
    staff?.user?.clinicId &&
    staff.user.permissions?.includes(PERMISSIONS.VIDEOCALLS_MANAGE)
  ) {
    return {
      clinicId: staff.user.clinicId,
      role: "PROFISSIONAL",
      userId: staff.user.id,
    };
  }

  const patient = await getPatientSession();
  if (patient) {
    return {
      clinicId: patient.clinicId,
      role: "PACIENTE",
      patientId: patient.patientId,
    };
  }

  return null;
}

export async function createVideoCallRoom(input: {
  clinicId: string;
  actorId?: string;
  patientId: string;
  scheduleEventId?: string | null;
}) {
  return withClinicOrg(input.clinicId, async () => {
    await requireModule(input.clinicId, "VIDEOCALLS");

    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, clinicId: input.clinicId },
    });
    if (!patient) throw new Error("Paciente não encontrado");

    const room = await prisma.videoCallRoom.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        scheduleEventId: input.scheduleEventId ?? null,
        createdById: input.actorId ?? null,
      },
    });

    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "VIDEOCALL_CHANGE",
      entityType: "VideoCallRoom",
      entityId: room.id,
      afterData: { patientId: room.patientId, scheduleEventId: room.scheduleEventId },
    });

    return room;
  });
}

export async function cancelVideoCallRoom(input: {
  clinicId: string;
  roomId: string;
  actorId?: string;
}) {
  return withClinicOrg(input.clinicId, async () => {
    const room = await prisma.videoCallRoom.findFirst({
      where: { id: input.roomId, clinicId: input.clinicId },
    });
    if (!room) throw new Error("Sala não encontrada");

    const updated = await prisma.videoCallRoom.update({
      where: { id: room.id },
      data: { status: "CANCELADA", endedAt: new Date() },
    });

    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "VIDEOCALL_CHANGE",
      entityType: "VideoCallRoom",
      entityId: room.id,
    });

    return updated;
  });
}

export async function listVideoCallRooms(clinicId: string) {
  return withClinicOrg(clinicId, () =>
    prisma.videoCallRoom.findMany({
      where: { clinicId, status: { not: "CANCELADA" } },
      include: {
        patient: { select: { fullName: true } },
        scheduleEvent: { select: { title: true, startsAt: true } },
        recordings: { select: { id: true, createdAt: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  );
}

export async function getVideoCallRoom(clinicId: string, roomId: string) {
  return withClinicOrg(clinicId, () =>
    prisma.videoCallRoom.findFirst({
      where: { id: roomId, clinicId },
      include: {
        patient: { select: { fullName: true } },
        scheduleEvent: { select: { title: true, startsAt: true } },
      },
    }),
  );
}

export async function setVideoCallConsent(input: {
  clinicId: string;
  roomId: string;
  role: VideoCallParticipantRole;
}) {
  return withClinicOrg(input.clinicId, async () => {
    const room = await prisma.videoCallRoom.findFirst({
      where: { id: input.roomId, clinicId: input.clinicId },
    });
    if (!room) throw new Error("Sala não encontrada");

    return prisma.videoCallRoom.update({
      where: { id: room.id },
      data:
        input.role === "PACIENTE"
          ? { patientConsentAt: new Date() }
          : { staffConsentAt: new Date() },
    });
  });
}

const ALLOWED_TRANSITIONS: Record<VideoCallStatus, VideoCallStatus[]> = {
  CRIADA: ["AGUARDANDO", "CANCELADA"],
  AGUARDANDO: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["ENCERRADA"],
  ENCERRADA: [],
  CANCELADA: [],
};

export async function transitionVideoCallStatus(input: {
  clinicId: string;
  roomId: string;
  status: VideoCallStatus;
  role: VideoCallParticipantRole;
}) {
  if (input.role === "PACIENTE") {
    throw new Error("Somente o profissional pode alterar o status da sala");
  }
  return withClinicOrg(input.clinicId, async () => {
    const room = await prisma.videoCallRoom.findFirst({
      where: { id: input.roomId, clinicId: input.clinicId },
    });
    if (!room) throw new Error("Sala não encontrada");
    if (!ALLOWED_TRANSITIONS[room.status].includes(input.status)) {
      throw new Error(`Transição inválida: ${room.status} -> ${input.status}`);
    }

    const data: Prisma.VideoCallRoomUpdateInput = { status: input.status };
    if (input.status === "EM_ANDAMENTO" && !room.startedAt) data.startedAt = new Date();
    if (input.status === "ENCERRADA" || input.status === "CANCELADA") data.endedAt = new Date();

    return prisma.videoCallRoom.update({ where: { id: room.id }, data });
  });
}

const signalSchema = z.object({
  type: z.enum(["offer", "answer", "ice-candidate", "leave"]),
  payload: z.unknown(),
});

export async function appendVideoCallSignal(input: {
  clinicId: string;
  roomId: string;
  fromRole: VideoCallParticipantRole;
  type: string;
  payload: unknown;
}) {
  const parsed = signalSchema.parse({ type: input.type, payload: input.payload });
  return withClinicOrg(input.clinicId, async () => {
    const room = await prisma.videoCallRoom.findFirst({
      where: { id: input.roomId, clinicId: input.clinicId },
    });
    if (!room) throw new Error("Sala não encontrada");

    return prisma.videoCallSignal.create({
      data: {
        roomId: room.id,
        fromRole: input.fromRole,
        type: parsed.type,
        payload: parsed.payload as Prisma.InputJsonValue,
      },
    });
  });
}

export async function createVideoCallRecording(input: {
  clinicId: string;
  roomId: string;
  actorId?: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return withClinicOrg(input.clinicId, async () => {
    const room = await prisma.videoCallRoom.findFirst({
      where: { id: input.roomId, clinicId: input.clinicId },
    });
    if (!room) throw new Error("Sala não encontrada");

    const recording = await prisma.videoCallRecording.create({
      data: {
        roomId: room.id,
        clinicId: input.clinicId,
        filePath: input.filePath,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        createdById: input.actorId ?? null,
      },
    });

    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "VIDEOCALL_CHANGE",
      entityType: "VideoCallRecording",
      entityId: recording.id,
      afterData: { roomId: room.id, sizeBytes: recording.sizeBytes },
    });

    return recording;
  });
}

export async function getVideoCallRecording(clinicId: string, recordingId: string) {
  return withClinicOrg(clinicId, () =>
    prisma.videoCallRecording.findFirst({
      where: { id: recordingId, clinicId },
    }),
  );
}

export async function listVideoCallSignalsSince(input: {
  clinicId: string;
  roomId: string;
  forRole: VideoCallParticipantRole;
  sinceId?: string | null;
}) {
  const otherRole: VideoCallParticipantRole =
    input.forRole === "PACIENTE" ? "PROFISSIONAL" : "PACIENTE";

  return withClinicOrg(input.clinicId, () =>
    prisma.videoCallSignal.findMany({
      where: { roomId: input.roomId, fromRole: otherRole },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      ...(input.sinceId ? { cursor: { id: input.sinceId }, skip: 1 } : {}),
      take: 100,
    }),
  );
}
