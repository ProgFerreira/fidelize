import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { HEADER_REQUEST_ID } from "@/lib/organization-host";

/**
 * CONTEXTO DE ORGANIZAÇÃO (TENANT)
 *
 * 1. O `proxy` gera `x-fidelize-request-id` em toda requisição.
 * 2. O `auth()` grava o contexto num Map global indexado por esse id.
 * 3. A extensão do Prisma lê o Map (via `headers()`) — atravessa as fronteiras
 *    async do React Server Components no Next 16.
 *
 * FAIL-CLOSED: sem contexto, a operação lança em vez de devolver tudo.
 */

export interface ContextoTenant {
  organizationId: string;
  suporte?: { userId: string; reason: string };
}

interface EntradaRequest {
  contexto: ContextoTenant | null;
  criadoEm: number;
}

const globalTenant = globalThis as unknown as {
  __fidelizeTenantAls?: AsyncLocalStorage<ContextoTenant>;
  __fidelizeTenantSemAls?: AsyncLocalStorage<true>;
  __fidelizeTenantByReq?: Map<string, EntradaRequest>;
};

const armazenamento =
  globalTenant.__fidelizeTenantAls ??
  (globalTenant.__fidelizeTenantAls = new AsyncLocalStorage<ContextoTenant>());

const semEscopoAls =
  globalTenant.__fidelizeTenantSemAls ??
  (globalTenant.__fidelizeTenantSemAls = new AsyncLocalStorage<true>());

const porRequisicao =
  globalTenant.__fidelizeTenantByReq ??
  (globalTenant.__fidelizeTenantByReq = new Map<string, EntradaRequest>());

const TTL_MS = 5 * 60 * 1000;

function limparExpirados() {
  const agora = Date.now();
  for (const [id, entrada] of porRequisicao) {
    if (agora - entrada.criadoEm > TTL_MS) porRequisicao.delete(id);
  }
}

function entradaDe(reqId: string): EntradaRequest {
  let entrada = porRequisicao.get(reqId);
  if (!entrada) {
    limparExpirados();
    entrada = { contexto: null, criadoEm: Date.now() };
    porRequisicao.set(reqId, entrada);
  }
  return entrada;
}

async function requestIdAtual(): Promise<string | null> {
  try {
    return (await headers()).get(HEADER_REQUEST_ID);
  } catch {
    return null;
  }
}

export class SemContextoTenantError extends Error {
  constructor(model: string, operacao: string) {
    super(
      `Operação "${model}.${operacao}" sem contexto de organização. ` +
        `Toda consulta a dado de negócio precisa de uma organização definida. ` +
        `Se a operação é mesmo global (login, administração da plataforma, ` +
        `rotina de sistema), envolva-a em semOrganizacao().`,
    );
    this.name = "SemContextoTenantError";
  }
}

export function organizacaoAtual(): string | null {
  return armazenamento.getStore()?.organizationId ?? null;
}

export function contextoAtual(): ContextoTenant | null {
  return armazenamento.getStore() ?? null;
}

export function estaSemEscopo(): boolean {
  return semEscopoAls.getStore() === true;
}

/** Usado pela extensão Prisma — vê ALS e o Map da requisição Next. */
export async function resolverContextoTenant(): Promise<{
  organizationId: string | null;
  semEscopo: boolean;
  suporte?: ContextoTenant["suporte"];
}> {
  if (semEscopoAls.getStore() === true) {
    return { organizationId: null, semEscopo: true };
  }

  const als = armazenamento.getStore();
  if (als) {
    return {
      organizationId: als.organizationId,
      semEscopo: false,
      suporte: als.suporte,
    };
  }

  const reqId = await requestIdAtual();
  if (reqId) {
    const entrada = porRequisicao.get(reqId);
    if (entrada?.contexto) {
      return {
        organizationId: entrada.contexto.organizationId,
        semEscopo: false,
        suporte: entrada.contexto.suporte,
      };
    }
  }

  return { organizationId: null, semEscopo: false };
}

export function comOrganizacao<T>(
  contexto: ContextoTenant,
  fn: () => Promise<T>,
): Promise<T> {
  return armazenamento.run(contexto, async () => {
    const reqId = await requestIdAtual();
    if (reqId) {
      const entrada = entradaDe(reqId);
      const anterior = entrada.contexto;
      entrada.contexto = contexto;
      try {
        return await fn();
      } finally {
        entrada.contexto = anterior;
      }
    }
    return await fn();
  });
}

export async function estabelecerOrganizacao(
  contexto: ContextoTenant,
): Promise<void> {
  armazenamento.enterWith(contexto);
  const reqId = await requestIdAtual();
  if (reqId) entradaDe(reqId).contexto = contexto;
}

export function semOrganizacao<T>(fn: () => Promise<T>): Promise<T> {
  return semEscopoAls.run(true, async () => await fn());
}

export function semOrganizacaoSync<T>(fn: () => T): T {
  return semEscopoAls.run(true, fn);
}

export function exigirOrganizacao(): string {
  const id = organizacaoAtual();
  if (!id) {
    throw new SemContextoTenantError("(desconhecido)", "exigirOrganizacao");
  }
  return id;
}
