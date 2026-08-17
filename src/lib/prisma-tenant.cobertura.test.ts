import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _internos } from "./prisma-tenant";

/**
 * Sem DMMF exportado pelo client Prisma 7 gerado, MODELOS_TENANT é uma
 * lista mantida à mão (ver comentário em prisma-tenant.ts). Esse teste lê o
 * schema.prisma direto e falha o build se algum model ganhar `organizationId`
 * sem entrar na lista — é a rede de segurança contra o isolamento de tenant
 * "silenciosamente" deixar de cobrir um model novo.
 */
function modelosComOrganizationId(): string[] {
  const schema = readFileSync(
    join(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );
  const modelos: string[] = [];
  const blocos = schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const [, nome, corpo] of blocos) {
    if (/^\s*organizationId\b/m.test(corpo)) {
      modelos.push(nome);
    }
  }
  return modelos.sort();
}

describe("cobertura de isolamento multi-tenant", () => {
  it("todo model com organizationId no schema está em MODELOS_TENANT", () => {
    const doSchema = modelosComOrganizationId();
    const faltando = doSchema.filter((m) => !_internos.MODELOS_TENANT.has(m));

    expect(
      faltando,
      `Model(s) com organizationId fora de MODELOS_TENANT em prisma-tenant.ts: ${faltando.join(", ")}. ` +
        `Adicione o nome na lista antes de mergear — sem isso, queries desse model não são isoladas por organização.`,
    ).toEqual([]);
  });

  it("MODELOS_TENANT não tem entrada sem correspondência no schema (lista não vira lixo morto)", () => {
    const doSchema = new Set(modelosComOrganizationId());
    const sobrando = [..._internos.MODELOS_TENANT].filter(
      (m) => !doSchema.has(m),
    );

    expect(
      sobrando,
      `Model(s) em MODELOS_TENANT que não existem mais (ou perderam organizationId) no schema: ${sobrando.join(", ")}.`,
    ).toEqual([]);
  });
});
