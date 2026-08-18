import { NextResponse } from "next/server";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  saveChatTranscript,
} from "@/lib/videocalls";

export const runtime = "nodejs";

/** Grava o chat completo da chamada — só o lado profissional grava. */
export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;

  const caller = await identifyVideoCallCaller();
  if (!caller || caller.role !== "PROFISSIONAL") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const room = await getVideoCallRoom(caller.clinicId, roomId);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  try {
    const transcript = await saveChatTranscript({
      clinicId: caller.clinicId,
      roomId,
      actorId: caller.userId,
    });

    return NextResponse.json({ data: transcript }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gravar transcrição";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
