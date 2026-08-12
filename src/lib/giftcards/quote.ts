import { money } from "@/lib/money";

export function normalizeGiftCardCode(code: string) {
  return code.trim().toUpperCase();
}

export function giftCardCodeFromPaymentKey(idempotencyKey?: string | null) {
  if (!idempotencyKey?.startsWith("pay-gift:")) return null;
  const parts = idempotencyKey.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : null;
}

export function quoteGiftCardUse(input: {
  remainingAmount: number | string;
  amountDue: number | string;
  requestedAmount?: number | string | null;
  allowPartial: boolean;
}) {
  const remaining = money(input.remainingAmount);
  const due = money(input.amountDue);
  if (due.lte(0)) {
    throw new Error("Não há valor a pagar para usar o vale");
  }
  const requested =
    input.requestedAmount != null && String(input.requestedAmount).trim() !== ""
      ? money(input.requestedAmount)
      : remaining.lt(due)
        ? remaining
        : due;
  if (requested.lte(0)) throw new Error("Valor inválido");
  if (requested.gt(remaining)) throw new Error("Saldo insuficiente no vale");
  const use = requested.gt(due) ? due : requested;
  if (!input.allowPartial && !use.eq(remaining)) {
    if (remaining.gt(due)) {
      throw new Error(
        "Este vale não permite uso parcial e o saldo é maior que o valor a pagar",
      );
    }
    throw new Error("Este vale não permite uso parcial");
  }
  return {
    amount: Number(use.toFixed(4)),
    remainingAfter: Number(remaining.minus(use).toFixed(4)),
  };
}
