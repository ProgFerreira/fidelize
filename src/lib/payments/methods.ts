export const PDV_PAYMENT_METHODS = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "PIX" },
  { id: "credito", label: "Cartão crédito" },
  { id: "debito", label: "Cartão débito" },
  { id: "link", label: "Link de pagamento" },
] as const;

export type PdvPaymentMethodId = (typeof PDV_PAYMENT_METHODS)[number]["id"];

const PDV_IDS = new Set<string>(PDV_PAYMENT_METHODS.map((m) => m.id));

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  transferencia: "PIX",
  credito: "Cartão crédito",
  debito: "Cartão débito",
  cartao: "Cartão",
  card: "Cartão",
  link: "Link de pagamento",
  payment_link: "Link de pagamento",
  gift_card: "Vale-presente",
  beneficio: "Benefício / cashback",
  manual: "Não informado",
  presencial: "Não informado",
};

export function parsePdvPaymentMethod(
  raw: unknown,
): PdvPaymentMethodId | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (PDV_IDS.has(key)) return key as PdvPaymentMethodId;
  return null;
}

export function requirePdvPaymentMethod(raw: unknown): PdvPaymentMethodId {
  const parsed = parsePdvPaymentMethod(raw);
  if (!parsed) {
    throw new Error("Informe a forma de pagamento");
  }
  return parsed;
}

export function paymentMethodLabel(method: string | null | undefined) {
  const key = (method ?? "").trim().toLowerCase();
  if (!key) return "Não informado";
  return PAYMENT_METHOD_LABELS[key] ?? method!.trim();
}
