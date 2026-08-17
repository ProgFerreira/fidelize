import type { NextResponse } from "next/server";

/**
 * Headers de segurança aplicados a toda resposta pelo proxy (`src/proxy.ts`).
 * CSP fica só nas diretivas seguras de aplicar sem testar cada página
 * (frame-ancestors, object-src, base-uri) — script-src/style-src ficam de
 * fora por ora, exigem levantamento de todos os recursos externos antes.
 * O widget (`/embed/widget`) define seu próprio frame-ancestors por meta
 * tag para liberar o domínio da clínica, então não recebe X-Frame-Options
 * nem a CSP daqui (senão as duas políticas se somam e bloqueiam o embed).
 */
export function comHeadersSeguranca(
  res: NextResponse,
  pathname: string,
): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "geolocation=(), payment=(), usb=(), camera=(self), microphone=(self)",
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  if (!pathname.startsWith("/embed/widget")) {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    );
  }
  return res;
}
