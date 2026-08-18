import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  detectarTipoArquivo,
  extensaoDeTipo,
  type TipoArquivoDetectado,
} from "@/lib/uploads/sniff";
import { persistentStorageRoot } from "@/lib/persistent-storage-root";

const PERMITIDOS = new Set<TipoArquivoDetectado>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 3 * 1024 * 1024;

export function affiliatePayoutStorageRoot() {
  return path.join(persistentStorageRoot(), "storage", "affiliate-payouts");
}

export function absoluteAffiliatePayoutPath(relative: string) {
  if (!relative || relative.includes("\0")) {
    throw new Error("Caminho inválido");
  }
  const root = path.resolve(affiliatePayoutStorageRoot());
  const absolute = path.resolve(root, relative);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(prefix)) {
    throw new Error("Caminho inválido");
  }
  return absolute;
}

export async function saveAffiliatePayoutReceipt(params: {
  affiliateId: string;
  file: File;
}) {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  if (buffer.length <= 0 || buffer.length > MAX_BYTES) {
    throw new Error("Arquivo deve ter no máximo 3 MB");
  }
  const tipo = detectarTipoArquivo(buffer, PERMITIDOS);
  if (!tipo) {
    throw new Error("Use imagem JPG/PNG/WebP ou PDF");
  }

  const safe = params.affiliateId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safe) throw new Error("Afiliado inválido");
  const dir = path.join(affiliatePayoutStorageRoot(), safe);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${extensaoDeTipo(tipo)}`;
  await writeFile(path.join(dir, filename), buffer);

  return `/api/afiliado/comprovantes/${safe}/${filename}`;
}
