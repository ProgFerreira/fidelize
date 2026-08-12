import { auth } from "@/lib/auth";
import { ehAdminPlataforma } from "@/lib/plataforma";
import { listarOrganizacoes } from "@/lib/plataforma/suporte";
import { redirect } from "next/navigation";
import { OrganizacoesPainel } from "@/components/plataforma/organizacoes-painel";

export default async function OrganizacoesPage() {
  const session = await auth();
  if (!ehAdminPlataforma(session)) {
    redirect("/login");
  }
  if (session?.user?.suporteAcessoId) {
    redirect("/dashboard");
  }

  const orgs = await listarOrganizacoes();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Organizações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Administração da plataforma Fidelize
        </p>
        <p className="mt-3">
          <a
            href="/organizacoes/afiliados"
            className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            Programa de afiliados e parceiros
          </a>
        </p>
      </div>
      <OrganizacoesPainel initial={orgs} />
    </div>
  );
}
