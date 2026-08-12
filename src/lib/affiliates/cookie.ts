/** Helpers edge-safe (sem Prisma) para cookie de afiliado. */

export const AFFILIATE_COOKIE = "fid_aff";
export const DEFAULT_ATTRIBUTION_DAYS = 30;

export type AffCookiePayload = {
  code: string;
  visitToken: string;
  visitId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
  exp: number;
};

function toBase64Url(text: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "base64url").toString("utf8");
  }
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeAffCookie(payload: AffCookiePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeAffCookie(raw: string | undefined | null): AffCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as AffCookiePayload;
    if (!parsed?.code || !parsed.visitToken || !parsed.exp) return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildAffCookieFromRequest(input: {
  code: string;
  pathname: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  visitToken?: string;
  attributionDays?: number;
}): { value: string; maxAgeSeconds: number; payload: AffCookiePayload } {
  const days = input.attributionDays ?? DEFAULT_ATTRIBUTION_DAYS;
  const payload: AffCookiePayload = {
    code: input.code.trim().toLowerCase(),
    visitToken:
      input.visitToken ||
      (globalThis.crypto?.randomUUID?.() ?? `v-${Date.now()}`).replace(/-/g, ""),
    utmSource: input.utmSource || undefined,
    utmMedium: input.utmMedium || undefined,
    utmCampaign: input.utmCampaign || undefined,
    landingPath: input.pathname,
    exp: Date.now() + days * 24 * 60 * 60 * 1000,
  };
  return {
    value: encodeAffCookie(payload),
    maxAgeSeconds: days * 24 * 60 * 60,
    payload,
  };
}
