import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { extensaoTenant } from "@/lib/prisma-tenant";

/**
 * Cliente Prisma com isolamento multiempresa embutido.
 * Não existe cliente "cru" exportado — use `semOrganizacao()` para ops globais.
 *
 * Bump `PRISMA_CLIENT_REV` quando o schema mudar campos de modelos já existentes
 * (ex.: Procedure.imageUrl), para invalidar o singleton em hot-reload do Next.
 */
const PRISMA_CLIENT_REV = 3;

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof criarPrisma>;
  prismaRev?: number;
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
    // Evita ficar em "Salvando..." sem feedback quando o MySQL não responde.
    acquireTimeout: 8_000,
    connectTimeout: 5_000,
  });

  return new PrismaClient({ adapter }).$extends(extensaoTenant);
}

function clienteAtualizado(
  cliente: ReturnType<typeof criarPrisma> | undefined,
): cliente is ReturnType<typeof criarPrisma> {
  if (globalForPrisma.prismaRev !== PRISMA_CLIENT_REV) return false;

  const c = cliente as
    | {
        organization?: { findUnique?: unknown };
        scheduleEvent?: { findMany?: unknown };
        professional?: { findMany?: unknown };
        appointmentItem?: { findMany?: unknown };
        procedure?: { findMany?: unknown };
      }
    | undefined;
  return (
    !!c &&
    typeof c.organization?.findUnique === "function" &&
    typeof c.scheduleEvent?.findMany === "function" &&
    typeof c.professional?.findMany === "function" &&
    typeof c.appointmentItem?.findMany === "function" &&
    typeof c.procedure?.findMany === "function"
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
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = novo;
    globalForPrisma.prismaRev = PRISMA_CLIENT_REV;
  }
  return novo;
}

export const prisma = obterPrisma();

export type PrismaEstendido = typeof prisma;

export type TransacaoPrisma = Omit<
  PrismaEstendido,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
