import { describe, expect, it } from "vitest";
import { achatarWhereUnique, _internos } from "@/lib/prisma-tenant";

describe("achatarWhereUnique", () => {
  it("mantém id simples", () => {
    expect(achatarWhereUnique({ id: "abc" })).toEqual({ id: "abc" });
  });

  it("expande compound unique", () => {
    expect(
      achatarWhereUnique({
        clinicId_code: { clinicId: "c1", code: "WHATSAPP" },
      }),
    ).toEqual({ clinicId: "c1", code: "WHATSAPP" });
  });

  it("não achata operadores Prisma", () => {
    expect(achatarWhereUnique({ name: { equals: "x" } })).toEqual({
      name: { equals: "x" },
    });
  });
});

describe("extensão tenant", () => {
  it("não trata findUnique como leitura com where extra", () => {
    expect(_internos.LEITURAS.has("findUnique")).toBe(false);
    expect(_internos.LEITURAS.has("findFirst")).toBe(true);
  });
});
