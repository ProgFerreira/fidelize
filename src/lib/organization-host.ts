/**
 * Resolução de host / subdomínio — edge-safe (proxy + login).
 */

export const SUBDOMINIOS_RESERVADOS = new Set([
  "admin",
  "www",
  "app",
  "api",
  "static",
  "assets",
  "mail",
  "suporte",
  "plataforma",
  "paciente",
  "p",
]);

/** Domínios de preview PaaS onde o 1º label é o site, não a organização. */
const APEX_PAAS_SUFFIXES = [".hostingersite.com"] as const;

/** Slug da organização interna que abriga papéis da plataforma. */
export const SLUG_ORG_PLATAFORMA = "_plataforma";

/** Host da administração da plataforma. */
export const SUBDOMINIO_PLATAFORMA = "admin";

export const HEADER_ORG_SLUG = "x-organization-slug";

/** Id estável da requisição HTTP (tenant Map atravessa RSC). */
export const HEADER_REQUEST_ID = "x-fidelize-request-id";

/** Host do portal do paciente (clínica via slug/customDomain). */
export const HEADER_CLINIC_HOST = "x-clinic-host";

export type ResolucaoHost =
  | { tipo: "organizacao"; slug: string }
  | { tipo: "plataforma" }
  | { tipo: "indefinido" };

function ehApexPaaS(semPorta: string): boolean {
  return APEX_PAAS_SUFFIXES.some(
    (suffix) =>
      semPorta.endsWith(suffix) &&
      semPorta.slice(0, -suffix.length).split(".").length === 1,
  );
}

/**
 * Extrai o slug do cabeçalho `Host`.
 * Em dev: `dermaphios.localhost:3000` resolve sem DNS.
 * Em Hostinger preview (`*.hostingersite.com`): trata como apex — o usuário
 * informa o slug da organização no login (ex.: dermaphios).
 */
export function resolverHost(host: string | null | undefined): ResolucaoHost {
  if (!host) return { tipo: "indefinido" };

  const semPorta = host.split(":")[0]!.toLowerCase();
  const partes = semPorta.split(".");

  if (partes.length < 2) return { tipo: "indefinido" };

  // Preview Hostinger / PaaS: site-id.hostingersite.com ≠ organização
  if (ehApexPaaS(semPorta)) return { tipo: "indefinido" };

  const primeiro = partes[0]!;
  const ehLocalhost = partes[partes.length - 1] === "localhost";
  const temSubdominio = ehLocalhost ? partes.length >= 2 : partes.length >= 3;

  if (!temSubdominio) return { tipo: "indefinido" };
  if (primeiro === SUBDOMINIO_PLATAFORMA) return { tipo: "plataforma" };
  if (SUBDOMINIOS_RESERVADOS.has(primeiro)) return { tipo: "indefinido" };
  if (primeiro.startsWith("_")) return { tipo: "indefinido" };

  return { tipo: "organizacao", slug: primeiro };
}
