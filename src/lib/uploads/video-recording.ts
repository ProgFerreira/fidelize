import { randomUUID } from "crypto";
import { mkdir, unlink } from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import { persistentStorageRoot } from "@/lib/persistent-storage-root";

const ALLOWED_MIME = new Set(["video/webm"]);
const DEFAULT_MAX_MB = 500;

function maxBytes() {
  const mb = Number(process.env.VIDEO_RECORDING_MAX_MB) || DEFAULT_MAX_MB;
  return mb * 1024 * 1024;
}

function storageRoot() {
  return path.join(persistentStorageRoot(), "storage", "recordings");
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export async function saveVideoCallRecording(params: {
  clinicId: string;
  roomId: string;
  mimeType: string;
  body: ReadableStream<Uint8Array> | null;
}): Promise<{ relativePath: string; sizeBytes: number }> {
  const mimeType = params.mimeType.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Formato de gravação não suportado (use webm)");
  }
  if (!params.body) throw new Error("Corpo da requisição vazio");

  const clinicSafe = safeSegment(params.clinicId);
  const roomSafe = safeSegment(params.roomId);
  if (!clinicSafe || !roomSafe) throw new Error("Identificadores inválidos");

  const dir = path.join(storageRoot(), clinicSafe);
  await mkdir(dir, { recursive: true });

  const filename = `${roomSafe}-${randomUUID()}.webm`;
  const absolute = path.join(dir, filename);
  const relative = path.join(clinicSafe, filename);

  const limit = maxBytes();
  let received = 0;
  let limitExceeded = false;

  const nodeReadable = Readable.fromWeb(
    params.body as unknown as NodeWebReadableStream<Uint8Array>,
  );
  const writeStream = createWriteStream(absolute);

  nodeReadable.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > limit && !limitExceeded) {
      limitExceeded = true;
      nodeReadable.destroy(new Error("LIMITE_EXCEDIDO"));
    }
  });

  try {
    await pipeline(nodeReadable, writeStream);
  } catch (error) {
    await unlink(absolute).catch(() => undefined);
    if (limitExceeded) {
      throw new Error(`Gravação excede o limite de ${limit / (1024 * 1024)} MB`);
    }
    throw error;
  }

  return { relativePath: relative, sizeBytes: received };
}

export async function deleteVideoCallRecordingFile(relativePath: string) {
  const absolute = path.join(storageRoot(), relativePath);
  if (!absolute.startsWith(storageRoot())) return;
  try {
    await unlink(absolute);
  } catch {
    // já ausente
  }
}

export function absoluteRecordingPath(relativePath: string) {
  const absolute = path.join(storageRoot(), relativePath);
  if (!absolute.startsWith(storageRoot())) throw new Error("Caminho inválido");
  return absolute;
}
