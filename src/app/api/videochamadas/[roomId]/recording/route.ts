import { NextResponse } from "next/server";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  createVideoCallRecording,
} from "@/lib/videocalls";
import { saveVideoCallRecording } from "@/lib/uploads/video-recording";

export const runtime = "nodejs";

/** Upload da gravação ao encerrar a chamada — só o lado profissional grava. */
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

  const mimeType = request.headers.get("content-type") ?? "video/webm";

  try {
    const saved = await saveVideoCallRecording({
      clinicId: caller.clinicId,
      roomId,
      mimeType,
      body: request.body,
    });

    const recording = await createVideoCallRecording({
      clinicId: caller.clinicId,
      roomId,
      actorId: caller.userId,
      filePath: saved.relativePath,
      mimeType: "video/webm",
      sizeBytes: saved.sizeBytes,
    });

    return NextResponse.json({ data: recording }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar gravação";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
