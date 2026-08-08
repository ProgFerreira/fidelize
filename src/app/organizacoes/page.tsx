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
      </div>
      <OrganizacoesPainel initial={orgs} />
    </div>
  );
}
