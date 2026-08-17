import "@/lib/load-env";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import {
  HEADER_ORG_SLUG,
  HEADER_REQUEST_ID,
  HEADER_PATHNAME,
  resolverHost,
} from "@/lib/organization-host";
import {
  AFFILIATE_COOKIE,
  buildAffCookieFromRequest,
} from "@/lib/affiliates/cookie";
import { comHeadersSeguranca } from "@/lib/security-headers";

const { auth } = NextAuth(authConfig);

/**
 * Deny-by-default: tudo exige sessão, salvo esta allowlist.
 * APIs da lista autenticam sozinhas (API key, cron secret, HMAC).
 */
const ROTAS_PUBLICAS = [
  "/",
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/paciente",
  "/p",
  "/embed",
  "/calculadora",
  "/i",
  "/indicacao",
  "/api/auth",
  "/api/health",
  "/api/setup",
  "/api/cron",
  "/api/integration",
  "/api/webhooks",
  "/api/v1",
  "/api/affiliates",
  "/api/videochamadas",
];

function rotaPublica(pathname: string) {
  if (pathname === "/nps") return false;
  if (pathname.startsWith("/nps/")) return true;
  return ROTAS_PUBLICAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
}

function caminhoPermitidoAfiliado(pathname: string) {
  return (
    pathname.startsWith("/afiliado") ||
    pathname.startsWith("/api/afiliado") ||
    pathname.startsWith("/api/auth")
  );
}

function respostaJsonApi(status: number, mensagem: string) {
  return NextResponse.json({ error: mensagem }, { status });
}

function novoRequestId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `req-${Date.now()}-${Math.random()}`
  );
}

function comCookieRef(
  req: { nextUrl: URL; cookies: { get: (n: string) => { value: string } | undefined } },
  res: NextResponse,
) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref || ref.length > 32) return res;
  const built = buildAffCookieFromRequest({
    code: ref,
    pathname: req.nextUrl.pathname,
    utmSource: req.nextUrl.searchParams.get("utm_source"),
    utmMedium: req.nextUrl.searchParams.get("utm_medium"),
    utmCampaign: req.nextUrl.searchParams.get("utm_campaign"),
  });
  res.cookies.set(AFFILIATE_COOKIE, built.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: built.maxAgeSeconds,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const sessao = req.auth;
  const ehApi = pathname.startsWith("/api/");

  const host = resolverHost(req.headers.get("host"));

  const cabecalhos = new Headers(req.headers);
  cabecalhos.set(
    HEADER_ORG_SLUG,
    host.tipo === "organizacao" ? host.slug : "",
  );
  cabecalhos.set(HEADER_REQUEST_ID, novoRequestId());
  cabecalhos.set(HEADER_PATHNAME, pathname);
  const seguir = () =>
    comCookieRef(req, NextResponse.next({ request: { headers: cabecalhos } }));

  if (rotaPublica(pathname)) {
    return comHeadersSeguranca(seguir(), pathname);
  }

  if (!sessao?.user) {
    if (ehApi)
      return comHeadersSeguranca(
        respostaJsonApi(401, "Não autenticado"),
        pathname,
      );
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return comHeadersSeguranca(
      comCookieRef(req, NextResponse.redirect(url)),
      pathname,
    );
  }

  const slugSessao = sessao.user.organizationSlug ?? null;
  const ehAfiliado = sessao.user.roleCode === "AFFILIATE";

  if (host.tipo === "organizacao") {
    if (slugSessao !== host.slug) {
      if (ehApi)
        return comHeadersSeguranca(
          respostaJsonApi(401, "Sessão de outra organização"),
          pathname,
        );
      const url = new URL("/login", req.url);
      url.searchParams.set("motivo", "organizacao-diferente");
      return comHeadersSeguranca(NextResponse.redirect(url), pathname);
    }
  } else if (host.tipo === "plataforma") {
    const ehAdmin = Boolean(sessao.user.ehAdminPlataforma);
    if (slugSessao !== null || (!ehAdmin && !ehAfiliado)) {
      if (ehApi)
        return comHeadersSeguranca(
          respostaJsonApi(403, "Acesso restrito à plataforma"),
          pathname,
        );
      return comHeadersSeguranca(
        NextResponse.redirect(new URL("/login", req.url)),
        pathname,
      );
    }
    if (ehAfiliado && !caminhoPermitidoAfiliado(pathname)) {
      return comHeadersSeguranca(
        NextResponse.redirect(new URL("/afiliado", req.url)),
        pathname,
      );
    }
  }

  if (ehAfiliado) {
    if (!caminhoPermitidoAfiliado(pathname)) {
      return comHeadersSeguranca(
        NextResponse.redirect(new URL("/afiliado", req.url)),
        pathname,
      );
    }
    return comHeadersSeguranca(seguir(), pathname);
  }

  if (sessao.user.ehAdminPlataforma && !sessao.user.suporteAcessoId) {
    const permitidoPlataforma =
      pathname.startsWith("/organizacoes") ||
      pathname.startsWith("/api/plataforma") ||
      pathname.startsWith("/api/afiliado") ||
      pathname.startsWith("/api/auth");

    if (!permitidoPlataforma) {
      if (ehApi) {
        return comHeadersSeguranca(
          respostaJsonApi(
            403,
            "Entre em uma organização pelo painel da plataforma",
          ),
          pathname,
        );
      }
      return comHeadersSeguranca(
        NextResponse.redirect(new URL("/organizacoes", req.url)),
        pathname,
      );
    }
  }

  if (
    sessao.user.ehAdminPlataforma &&
    sessao.user.suporteAcessoId &&
    pathname.startsWith("/organizacoes")
  ) {
    return comHeadersSeguranca(
      NextResponse.redirect(new URL("/dashboard", req.url)),
      pathname,
    );
  }

  return comHeadersSeguranca(seguir(), pathname);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
