import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal.Value;

export function money(value: MoneyInput = 0): Decimal {
  return new Decimal(value ?? 0);
}

export function moneyToString(value: MoneyInput, decimals = 4): string {
  return money(value).toFixed(decimals);
}

export function moneyToNumber(value: MoneyInput): number {
  return money(value).toNumber();
}

export function formatBRL(value: MoneyInput): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(money(value).toDecimalPlaces(2).toNumber());
}

export function percentOf(amount: MoneyInput, percent: MoneyInput): Decimal {
  return money(amount).mul(money(percent)).div(100).toDecimalPlaces(4);
}

export function roundMoney(value: MoneyInput, decimals = 2): Decimal {
  return money(value).toDecimalPlaces(decimals);
}

export { Decimal };
