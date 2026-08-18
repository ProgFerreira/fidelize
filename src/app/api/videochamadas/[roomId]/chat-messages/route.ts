import { NextResponse } from "next/server";
import { identifyVideoCallCaller, getVideoCallRoom, listChatMessages } from "@/lib/videocalls";

export const runtime = "nodejs";

/** Histórico completo do chat (dos dois lados) — usado ao (re)entrar na sala. */
export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;

  const caller = await identifyVideoCallCaller();
  if (!caller) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const room = await getVideoCallRoom(caller.clinicId, roomId);
  if (!room) return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });

  if (caller.role === "PACIENTE" && room.patientId !== caller.patientId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const messages = await listChatMessages(caller.clinicId, roomId);
  return NextResponse.json({ data: messages });
}
