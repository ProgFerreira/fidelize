import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em tempo constante (HMAC de ambos, depois
 * timingSafeEqual). Strings vazias / ausentes nunca batem.
 */
export function secretsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  const left = createHmac("sha256", "fidelize-cmp").update(a).digest();
  const right = createHmac("sha256", "fidelize-cmp").update(b).digest();
  return timingSafeEqual(left, right);
}

export function assertCronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected || expected.length < 16) return false;
  return secretsMatch(request.headers.get("x-cron-secret"), expected);
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function hmacSha256Base64Url(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
