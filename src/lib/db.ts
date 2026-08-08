import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { extensaoTenant } from "@/lib/prisma-tenant";

/**
 * Cliente Prisma com isolamento multiempresa embutido.
 * Não existe cliente "cru" exportado — use `semOrganizacao()` para ops globais.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof criarPrisma>;
};

function criarPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
    connectionLimit: 10,
  });

  return new PrismaClient({ adapter }).$extends(extensaoTenant);
}

function clienteAtualizado(
  cliente: ReturnType<typeof criarPrisma> | undefined,
): cliente is ReturnType<typeof criarPrisma> {
  return (
    !!cliente &&
    typeof (cliente as { organization?: { findUnique?: unknown } }).organization
      ?.findUnique === "function"
  );
}

function obterPrisma() {
  const existente = globalForPrisma.prisma;
  if (clienteAtualizado(existente)) return existente;

  if (existente) {
    void (existente as { $disconnect: () => Promise<void> })
      .$disconnect()
      .catch(() => undefined);
  }

  const novo = criarPrisma();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = novo;
  return novo;
}

export const prisma = obterPrisma();

export type PrismaEstendido = typeof prisma;

export type TransacaoPrisma = Omit<
  PrismaEstendido,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
