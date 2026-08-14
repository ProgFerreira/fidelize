import { describe, expect, it } from "vitest";
import { cabecalhosCorsWidget } from "@/lib/widget";

describe("cabecalhosCorsWidget", () => {
  it("não ecoa Origin quando a origem não é permitida", () => {
    const h = cabecalhosCorsWidget(null);
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("ecoa só a origem já validada", () => {
    const h = cabecalhosCorsWidget("https://clinica.exemplo");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://clinica.exemplo");
    expect(h.Vary).toBe("Origin");
  });

  it("aceita wildcard sem refletir um Origin arbitrário", () => {
    const h = cabecalhosCorsWidget("*");
    expect(h["Access-Control-Allow-Origin"]).toBe("*");
  });
});
