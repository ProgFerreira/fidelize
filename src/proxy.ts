import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import {
  HEADER_ORG_SLUG,
  HEADER_REQUEST_ID,
  resolverHost,
} from "@/lib/organization-host";

const { auth } = NextAuth(authConfig);

const ROTAS_PUBLICAS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/setup",
  "/paciente",
  "/p",
  "/embed",
  "/calculadora",
  "/api/cron",
  "/api/integration",
  "/api/webhooks",
  "/api/v1",
];

function respostaJsonApi(status: number, mensagem: string) {
  return NextResponse.json({ error: mensagem }, { status });
}

function novoRequestId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `req-${Date.now()}-${Math.random()}`
  );
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
  cabecalhos.set(
    HEADER_REQUEST_ID,
    req.headers.get(HEADER_REQUEST_ID) ?? novoRequestId(),
  );
  const seguir = () => NextResponse.next({ request: { headers: cabecalhos } });

  if (ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    const res = seguir();
    if (pathname.startsWith("/embed/widget")) {
      // Defesa em profundidade: página também emite CSP via meta.
      // Aqui reforçamos X-Frame-Options genérico quando não há clínica.
      res.headers.set("X-Content-Type-Options", "nosniff");
      res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    }
    return res;
  }

  // Staff paths and platform require session
  const precisaAuth =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/recepcao") ||
    pathname.startsWith("/agenda") ||
    pathname.startsWith("/profissionais") ||
    pathname.startsWith("/servicos") ||
    pathname.startsWith("/pacientes") ||
    pathname.startsWith("/cartoes") ||
    pathname.startsWith("/campanhas") ||
    pathname.startsWith("/relatorios") ||
    pathname.startsWith("/configuracoes") ||
    pathname.startsWith("/auditoria") ||
    pathname.startsWith("/modulos") ||
    pathname.startsWith("/implantacao") ||
    pathname.startsWith("/segmentos") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/comunicacoes") ||
    pathname.startsWith("/consentimentos") ||
    pathname.startsWith("/automacoes") ||
    pathname.startsWith("/indicacoes") ||
    pathname.startsWith("/nps") ||
    pathname.startsWith("/recompensas") ||
    pathname.startsWith("/vouchers") ||
    pathname.startsWith("/vales-presente") ||
    pathname.startsWith("/aceleradores") ||
    pathname.startsWith("/recuperacao") ||
    pathname.startsWith("/integracoes") ||
    pathname.startsWith("/planos") ||
    pathname.startsWith("/loyalty360") ||
    pathname.startsWith("/organizacoes") ||
    pathname.startsWith("/api/plataforma") ||
    pathname.startsWith("/api/import");

  if (!precisaAuth) {
    return seguir();
  }

  if (!sessao?.user) {
    if (ehApi) return respostaJsonApi(401, "Não autenticado");
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const slugSessao = sessao.user.organizationSlug ?? null;

  if (host.tipo === "organizacao") {
    if (slugSessao !== host.slug) {
      if (ehApi) return respostaJsonApi(401, "Sessão de outra organização");
      const url = new URL("/login", req.url);
      url.searchParams.set("motivo", "organizacao-diferente");
      return NextResponse.redirect(url);
    }
  } else if (host.tipo === "plataforma") {
    const ehAdmin = Boolean(sessao.user.ehAdminPlataforma);
    if (slugSessao !== null || !ehAdmin) {
      if (ehApi) return respostaJsonApi(403, "Acesso restrito à plataforma");
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (sessao.user.ehAdminPlataforma && !sessao.user.suporteAcessoId) {
    const permitidoPlataforma =
      pathname.startsWith("/organizacoes") ||
      pathname.startsWith("/api/plataforma") ||
      pathname.startsWith("/api/auth");

    if (!permitidoPlataforma) {
      if (ehApi) {
        return respostaJsonApi(
          403,
          "Entre em uma organização pelo painel da plataforma",
        );
      }
      return NextResponse.redirect(new URL("/organizacoes", req.url));
    }
  }

  if (
    sessao.user.ehAdminPlataforma &&
    sessao.user.suporteAcessoId &&
    pathname.startsWith("/organizacoes")
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return seguir();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
