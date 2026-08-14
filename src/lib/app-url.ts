import { headers } from "next/headers";

export function appBaseUrlFromEnv() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    ""
  );
}

export async function appBaseUrl() {
  const fromEnv = appBaseUrlFromEnv();
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "";
  const proto =
    h.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
