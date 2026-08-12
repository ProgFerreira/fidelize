import Link from "next/link";
import { requireAffiliateSession } from "@/lib/auth/guards";

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
  await requireAffiliateSession();

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-8">
      <header className="mb-8 border-b border-slate-200 pb-4 dark:border-slate-800">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Painel do afiliado
        </h1>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
