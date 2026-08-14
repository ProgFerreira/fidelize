import { describe, expect, it } from "vitest";
import {
  detectarTipoArquivo,
  extensaoDeTipo,
  type TipoArquivoDetectado,
} from "@/lib/uploads/sniff";

const TODOS = new Set<TipoArquivoDetectado>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

describe("detectarTipoArquivo", () => {
  it("reconhece JPEG/PNG/WebP/PDF pelos magic bytes", () => {
    expect(detectarTipoArquivo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), TODOS)).toBe(
      "image/jpeg",
    );
    expect(
      detectarTipoArquivo(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        TODOS,
      ),
    ).toBe("image/png");
    expect(
      detectarTipoArquivo(
        Uint8Array.from(Buffer.from("RIFF....WEBP", "ascii")),
        TODOS,
      ),
    ).toBe("image/webp");
    expect(
      detectarTipoArquivo(Uint8Array.from(Buffer.from("%PDF-1.7", "ascii")), TODOS),
    ).toBe("application/pdf");
  });

  it("rejeita texto e MIME mentiroso", () => {
    expect(
      detectarTipoArquivo(Uint8Array.from(Buffer.from("not an image")), TODOS),
    ).toBeNull();
    expect(detectarTipoArquivo(new Uint8Array(0), TODOS)).toBeNull();
  });

  it("respeita a lista de tipos permitidos", () => {
    const soJpeg = new Set<TipoArquivoDetectado>(["image/jpeg"]);
    expect(
      detectarTipoArquivo(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        soJpeg,
      ),
    ).toBeNull();
  });

  it("mapeia extensão pelo tipo detectado, não pelo nome do client", () => {
    expect(extensaoDeTipo("image/jpeg")).toBe("jpg");
    expect(extensaoDeTipo("application/pdf")).toBe("pdf");
  });
});
