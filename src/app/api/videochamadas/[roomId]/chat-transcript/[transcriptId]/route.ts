import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  getVideoCallChatTranscript,
} from "@/lib/videocalls";
import { absoluteChatTranscriptPath } from "@/lib/uploads/chat-transcript";

export const runtime = "nodejs";

/** Download da transcrição — restrita à equipe (dado sensível de saúde). */
export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string; transcriptId: string }> },
) {
  const { roomId, transcriptId } = await context.params;

  const caller = await identifyVideoCallCaller();
  if (!caller || caller.role !== "PROFISSIONAL") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const room = await getVideoCallRoom(caller.clinicId, roomId);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  const transcript = await getVideoCallChatTranscript(caller.clinicId, transcriptId);
  if (!transcript || transcript.roomId !== roomId) {
    return NextResponse.json({ error: "Transcrição não encontrada" }, { status: 404 });
  }

  let absolutePath: string;
  let fileSize: number;
  try {
    absolutePath = absoluteChatTranscriptPath(transcript.filePath);
    fileSize = (await stat(absolutePath)).size;
  } catch {
    return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });
  }

  const nodeStream = createReadStream(absolutePath);
  return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": String(fileSize),
      "Content-Disposition": `attachment; filename="transcricao-${transcriptId}.txt"`,
      "Cache-Control": "private, no-store",
    },
  });
}
