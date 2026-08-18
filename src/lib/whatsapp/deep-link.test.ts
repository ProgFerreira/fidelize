import { describe, expect, it } from "vitest";
import { whatsappDeepLink } from "@/lib/whatsapp/deep-link";

describe("whatsappDeepLink", () => {
  it("adiciona DDI 55 quando o telefone não tem", () => {
    const url = whatsappDeepLink("(11) 99999-8888", "olá");
    expect(url).toContain("https://wa.me/5511999998888?text=");
  });

  it("mantém o telefone como está quando já tem DDI", () => {
    const url = whatsappDeepLink("5511999998888", "olá");
    expect(url).toContain("https://wa.me/5511999998888?text=");
  });

  it("codifica a mensagem na query string", () => {
    const url = whatsappDeepLink("11999998888", "código: 123456");
    expect(url).toContain(encodeURIComponent("código: 123456"));
  });
});
