import { describe, expect, it } from "vitest";
import { classesBotao } from "./button";

describe("classesBotao", () => {
  it("expõe as classes do botão para usar em Link sem aninhar Button", () => {
    const classes = classesBotao({ variante: "contorno", className: "w-full" });
    expect(classes).toContain("border");
    expect(classes).toContain("w-full");
    expect(classes).toContain("inline-flex");
  });

  it("aceita o alias gold/secondary usado no portal", () => {
    expect(classesBotao({ variante: "gold" })).toContain("bg-brand-gold");
    expect(classesBotao({ variant: "secondary" })).toContain("bg-slate-100");
  });
});
