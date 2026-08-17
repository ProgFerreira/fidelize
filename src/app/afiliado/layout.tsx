import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { requireAffiliateSession } from "@/lib/auth/guards";
import { HEADER_PATHNAME } from "@/lib/organization-host";
import { Button, QueryToast } from "@/components/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/afiliado", label: "Visão geral" },
  { href: "/afiliado/indicacoes", label: "Indicações" },
  { href: "/afiliado/comissoes", label: "Comissões" },
  { href: "/afiliado/pagamentos", label: "Pagamentos" },
  { href: "/afiliado/perfil", label: "Perfil" },
];

export default async function AfiliadoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAffiliateSession();
  const pathname = (await headers()).get(HEADER_PATHNAME) ?? "/afiliado";

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-8">
      <header className="mb-8 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-dark">
              Fidelize
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Painel do afiliado
            </h1>
          </div>
          <form action="/api/auth/signout" method="post">
            <Button type="submit" variante="contorno" tamanho="sm">
              Sair ({session.user.email})
            </Button>
          </form>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Menu do afiliado">
          {NAV.map((item) => {
            const atual =
              item.href === "/afiliado"
                ? pathname === "/afiliado"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={atual ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  atual && "bg-slate-100 font-medium text-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
      <Suspense fallback={null}>
        <QueryToast
          mensagens={{
            salvo: { mensagem: "Perfil atualizado" },
          }}
        />
      </Suspense>
    </div>
  );
}
