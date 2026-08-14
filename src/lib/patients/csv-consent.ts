/** Interpreta coluna opcional de consentimento no CSV de pacientes. */
export function parseConsentimentoCsv(raw: string | undefined) {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "sim" || v === "yes";
}
