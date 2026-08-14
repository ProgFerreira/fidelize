import { NextResponse } from "next/server";
import { z } from "zod";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  setVideoCallConsent,
  transitionVideoCallStatus,
} from "@/lib/videocalls";

export const runtime = "nodejs";

async function authorizedRoom(roomId: string) {
  const caller = await identifyVideoCallCaller();
  if (!caller) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };

  const room = await getVideoCallRoom(caller.clinicId, roomId);
  if (!room) return { error: NextResponse.json({ error: "Sala não encontrada" }, { status: 404 }) };

  if (caller.role === "PACIENTE" && room.patientId !== caller.patientId) {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };
  }

  return { caller, room };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const result = await authorizedRoom(roomId);
  if ("error" in result) return result.error;

  return NextResponse.json({ data: { ...result.room, role: result.caller.role } });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent") }),
  z.object({
    action: z.literal("status"),
    status: z.enum(["AGUARDANDO", "EM_ANDAMENTO", "ENCERRADA", "CANCELADA"]),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const result = await authorizedRoom(roomId);
  if ("error" in result) return result.error;
  const { caller } = result;

  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    if (body.data.action === "consent") {
      const room = await setVideoCallConsent({
        clinicId: caller.clinicId,
        roomId,
        role: caller.role,
      });
      return NextResponse.json({ data: room });
    }

    const room = await transitionVideoCallStatus({
      clinicId: caller.clinicId,
      roomId,
      status: body.data.status,
    });
    return NextResponse.json({ data: room });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar sala";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
