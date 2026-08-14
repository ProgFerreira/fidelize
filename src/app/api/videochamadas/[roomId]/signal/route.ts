import { NextResponse } from "next/server";
import { z } from "zod";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  appendVideoCallSignal,
  listVideoCallSignalsSince,
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

const postSchema = z.object({
  type: z.enum(["offer", "answer", "ice-candidate", "leave"]),
  payload: z.unknown(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const result = await authorizedRoom(roomId);
  if ("error" in result) return result.error;
  const { caller } = result;

  const body = postSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const signal = await appendVideoCallSignal({
    clinicId: caller.clinicId,
    roomId,
    fromRole: caller.role,
    type: body.data.type,
    payload: body.data.payload,
  });

  return NextResponse.json({ data: signal }, { status: 201 });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const result = await authorizedRoom(roomId);
  if ("error" in result) return result.error;
  const { caller } = result;

  const since = new URL(request.url).searchParams.get("since");

  const signals = await listVideoCallSignalsSince({
    clinicId: caller.clinicId,
    roomId,
    forRole: caller.role,
    sinceId: since,
  });

  return NextResponse.json({ data: signals });
}
