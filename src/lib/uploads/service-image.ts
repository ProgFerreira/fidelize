import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  detectarTipoArquivo,
  extensaoDeTipo,
  type TipoArquivoDetectado,
} from "@/lib/uploads/sniff";

const PERMITIDOS = new Set<TipoArquivoDetectado>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_BYTES = 2 * 1024 * 1024;

function uploadsRoot() {
  return path.join(process.cwd(), "public", "uploads", "services");
}

export function isManagedServiceImage(url: string | null | undefined) {
  return Boolean(url && url.startsWith("/uploads/services/"));
}

export async function saveServiceImage(params: {
  clinicId: string;
  file: File;
}) {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  if (buffer.length <= 0 || buffer.length > MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 2 MB");
  }
  const tipo = detectarTipoArquivo(buffer, PERMITIDOS);
  if (!tipo) {
    throw new Error("Use imagem JPG, PNG ou WebP");
  }

  const clinicSafe = params.clinicId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!clinicSafe) throw new Error("Clínica inválida para upload");

  const dir = path.join(uploadsRoot(), clinicSafe);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${extensaoDeTipo(tipo)}`;
  const absolute = path.join(dir, filename);
  await writeFile(absolute, buffer);

  return `/uploads/services/${clinicSafe}/${filename}`;
}

export async function deleteManagedServiceImage(url: string | null | undefined) {
  if (!isManagedServiceImage(url) || !url) return;
  const relative = url.replace(/^\//, "");
  const absolute = path.join(process.cwd(), "public", relative);
  const root = uploadsRoot();
  if (!absolute.startsWith(root)) return;
  try {
    await unlink(absolute);
  } catch {
    // arquivo já ausente
  }
}
