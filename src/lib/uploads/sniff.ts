/** Detecta tipo real pelo cabeçalho do arquivo, sem confiar no MIME do client. */

export type TipoArquivoDetectado =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

const EXT: Record<TipoArquivoDetectado, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensaoDeTipo(tipo: TipoArquivoDetectado) {
  return EXT[tipo];
}

export function detectarTipoArquivo(
  buf: Uint8Array,
  permitidos: ReadonlySet<TipoArquivoDetectado>,
): TipoArquivoDetectado | null {
  const tipo = sniff(buf);
  if (!tipo || !permitidos.has(tipo)) return null;
  return tipo;
}

function sniff(buf: Uint8Array): TipoArquivoDetectado | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return null;
}
