import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  getVideoCallRecording,
} from "@/lib/videocalls";
import { absoluteRecordingPath } from "@/lib/uploads/video-recording";

export const runtime = "nodejs";

/** Reprodução da gravação — restrita à equipe (dado sensível de saúde). */
export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string; recordingId: string }> },
) {
  const { roomId, recordingId } = await context.params;

  const caller = await identifyVideoCallCaller();
  if (!caller || caller.role !== "PROFISSIONAL") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const room = await getVideoCallRoom(caller.clinicId, roomId);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  const recording = await getVideoCallRecording(caller.clinicId, recordingId);
  if (!recording || recording.roomId !== roomId) {
    return NextResponse.json({ error: "Gravação não encontrada" }, { status: 404 });
  }

  let absolutePath: string;
  let fileSize: number;
  try {
    absolutePath = absoluteRecordingPath(recording.filePath);
    fileSize = (await stat(absolutePath)).size;
  } catch {
    return NextResponse.json({ error: "Arquivo indisponível" }, { status: 404 });
  }

  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : fileSize - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const nodeStream = createReadStream(absolutePath, { start, end });
    return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": recording.mimeType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const nodeStream = createReadStream(absolutePath);
  return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": recording.mimeType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}
