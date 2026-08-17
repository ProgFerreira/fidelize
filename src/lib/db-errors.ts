/** Falha de conexão/pool — MySQL parado, host errado ou limite esgotado. */
export function isBancoIndisponivel(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return (
    /pool timeout|P2039|45028|acquireTimeout|Can't connect|ECONNREFUSED|ETIMEDOUT|ECONNRESET/i.test(
      msg,
    ) ||
    code === "45028" ||
    code === "P2039"
  );
}

export const MSG_BANCO_INDISPONIVEL =
  "Banco de dados indisponível. Verifique se o MySQL está em execução e tente de novo.";
