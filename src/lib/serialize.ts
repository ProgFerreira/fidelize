/** Serializa valores Prisma (Decimal, Date, BigInt) para props/actions de Client Components. */
export function toPlain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (
        v != null &&
        typeof v === "object" &&
        typeof (v as { toFixed?: unknown }).toFixed === "function" &&
        typeof (v as { toNumber?: unknown }).toNumber === "function"
      ) {
        return (v as { toString: () => string }).toString();
      }
      return v;
    }),
  ) as T;
}

/** Como toPlain, mas tipa o retorno para DTOs de Client Components. */
export function toClientProps<T>(value: unknown): T {
  return toPlain(value) as T;
}

export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  return Number(value);
}
