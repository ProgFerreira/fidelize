import { describe, expect, it } from "vitest";
import { calcularRms } from "@/lib/videocalls/local-transcription";

describe("calcularRms", () => {
  it("retorna 0 pra silêncio total", () => {
    expect(calcularRms(new Float32Array(1000))).toBe(0);
  });

  it("retorna 0 pra array vazio", () => {
    expect(calcularRms(new Float32Array(0))).toBe(0);
  });

  it("retorna valor maior pra sinal com amplitude alta", () => {
    const baixo = new Float32Array(100).fill(0.001);
    const alto = new Float32Array(100).fill(0.5);
    expect(calcularRms(alto)).toBeGreaterThan(calcularRms(baixo));
  });
});
