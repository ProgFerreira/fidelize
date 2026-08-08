/**
 * Extensão de navegador (Chrome/Edge) — contrato.
 * Implementação: MV3 content script chama GET /api/v1/widget com a API key da clínica.
 */
export const BROWSER_EXTENSION_CONTRACT = {
  version: "1.0.0",
  permissions: ["storage"],
  host_permissions: ["https://*/api/v1/widget"],
  popup: {
    fields: ["apiKey", "patientPhone"],
    action: "fetchBalance",
  },
  endpoint: {
    method: "GET",
    path: "/api/v1/widget",
    query: ["key", "phone"],
  },
  notes: [
    "Somente leitura (saldo/pontos/categoria).",
    "Origem da extensão deve estar na allowlist WidgetOrigin ou usar chave com escopo widget.",
  ],
} as const;
