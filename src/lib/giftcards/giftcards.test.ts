import { describe, expect, it } from "vitest";
import { giftCardCodeFromPaymentKey, quoteGiftCardUse } from "./quote";
import { money, percentOf, moneyToString } from "@/lib/money";

describe("quoteGiftCardUse", () => {
  it("usa o menor entre saldo e valor a pagar quando não pede valor", () => {
    expect(
      quoteGiftCardUse({
        remainingAmount: 80,
        amountDue: 120,
        allowPartial: true,
      }).amount,
    ).toBe(80);
    expect(
      quoteGiftCardUse({
        remainingAmount: 200,
        amountDue: 50,
        allowPartial: true,
      }).amount,
    ).toBe(50);
  });

  it("respeita o valor pedido até o teto do saldo e do a pagar", () => {
    expect(
      quoteGiftCardUse({
        remainingAmount: 100,
        amountDue: 80,
        requestedAmount: 30,
        allowPartial: true,
      }).amount,
    ).toBe(30);
    expect(
      quoteGiftCardUse({
        remainingAmount: 100,
        amountDue: 80,
        requestedAmount: 90,
        allowPartial: true,
      }).amount,
    ).toBe(80);
  });

  it("bloqueia uso parcial quando o vale exige valor total", () => {
    expect(() =>
      quoteGiftCardUse({
        remainingAmount: 100,
        amountDue: 40,
        allowPartial: false,
      }),
    ).toThrow(/não permite uso parcial/);
  });
});

describe("giftCardCodeFromPaymentKey", () => {
  it("lê o código gravado no pagamento do vale", () => {
    expect(giftCardCodeFromPaymentKey("pay-gift:abc:GP123")).toBe("GP123");
    expect(giftCardCodeFromPaymentKey("pay-gift:abc:GP:X")).toBe("GP:X");
    expect(giftCardCodeFromPaymentKey("pay:abc")).toBeNull();
  });
});

describe("abate vale do caixa", () => {
  it("recalcula cashback só sobre o restante em dinheiro", () => {
    const paid = money(200).minus(50);
    const cashback = percentOf(paid, 5);
    expect(moneyToString(paid)).toBe("150.0000");
    expect(moneyToString(cashback)).toBe("7.5000");
  });
});
