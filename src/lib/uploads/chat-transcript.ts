import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { persistentStorageRoot } from "@/lib/persistent-storage-root";

function storageRoot() {
  return path.join(persistentStorageRoot(), "storage", "chat-transcripts");
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export async function saveChatTranscriptFile(params: {
  clinicId: string;
  roomId: string;
  content: string;
}): Promise<{ relativePath: string }> {
  const clinicSafe = safeSegment(params.clinicId);
  const roomSafe = safeSegment(params.roomId);
  if (!clinicSafe || !roomSafe) throw new Error("Identificadores inválidos");

  const dir = path.join(storageRoot(), clinicSafe);
  await mkdir(dir, { recursive: true });

  const filename = `${roomSafe}-${randomUUID()}.txt`;
  const absolute = path.join(dir, filename);
  const relative = path.join(clinicSafe, filename);

  await writeFile(absolute, params.content, "utf8");

  return { relativePath: relative };
}

/** Lê o conteúdo do arquivo pra exibir inline (ex.: histórico do paciente). */
export async function readChatTranscriptFile(relativePath: string): Promise<string> {
  return readFile(absoluteChatTranscriptPath(relativePath), "utf8");
}

export function absoluteChatTranscriptPath(relativePath: string) {
  const root = path.resolve(storageRoot());
  const absolute = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(prefix)) throw new Error("Caminho inválido");
  return absolute;
}
