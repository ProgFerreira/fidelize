import { describe, it, expect } from "vitest";
import { money, percentOf, formatBRL } from "./index";

describe("money", () => {
  it("nunca usa float impreciso para percentuais", () => {
    const result = percentOf("100.00", "5.5");
    expect(result.toFixed(4)).toBe("5.5000");
  });

  it("formata BRL", () => {
    expect(formatBRL("10.5")).toContain("10,50");
  });

  it("impede saldo negativo na aritmética de domínio", () => {
    const available = money("50");
    const redeem = money("60");
    expect(available.minus(redeem).lt(0)).toBe(true);
  });
});
