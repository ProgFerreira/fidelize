import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_BYTES = 3 * 1024 * 1024;

function uploadsRoot() {
  return path.join(process.cwd(), "public", "uploads", "affiliate-payouts");
}

export async function saveAffiliatePayoutReceipt(params: {
  affiliateId: string;
  file: File;
}) {
  const type = params.file.type;
  if (!ALLOWED.has(type)) {
    throw new Error("Use imagem JPG/PNG/WebP ou PDF");
  }
  if (params.file.size <= 0 || params.file.size > MAX_BYTES) {
    throw new Error("Arquivo deve ter no máximo 3 MB");
  }

  const safe = params.affiliateId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const dir = path.join(uploadsRoot(), safe);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${EXT[type]}`;
  const absolute = path.join(dir, filename);
  await writeFile(absolute, Buffer.from(await params.file.arrayBuffer()));

  return `/uploads/affiliate-payouts/${safe}/${filename}`;
}
