import { describe, expect, it } from "vitest";
import { destinoAposLogin } from "./post-login";

describe("destinoAposLogin", () => {
  it("envia afiliado para o painel próprio", () => {
    expect(destinoAposLogin({ roleCode: "AFFILIATE" })).toBe("/afiliado");
  });

  it("envia admin da plataforma para organizações", () => {
    expect(
      destinoAposLogin({ roleCode: "PLATFORM_ADMIN", ehAdminPlataforma: true }),
    ).toBe("/organizacoes");
  });

  it("mantém suporte no dashboard da clínica", () => {
    expect(
      destinoAposLogin({
        roleCode: "PLATFORM_ADMIN",
        ehAdminPlataforma: true,
        suporteAcessoId: "sup-1",
      }),
    ).toBe("/dashboard");
  });

  it("usa dashboard como destino padrão", () => {
    expect(destinoAposLogin({ roleCode: "RECEPTION" })).toBe("/dashboard");
    expect(destinoAposLogin(null)).toBe("/dashboard");
  });
});
