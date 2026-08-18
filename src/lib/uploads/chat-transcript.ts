import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
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

export function absoluteChatTranscriptPath(relativePath: string) {
  const root = path.resolve(storageRoot());
  const absolute = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(prefix)) throw new Error("Caminho inválido");
  return absolute;
}
