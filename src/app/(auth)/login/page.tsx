import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";
import { Stethoscope } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import {
  HEADER_ORG_SLUG,
  resolverHost,
} from "@/lib/organization-host";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(
      session.user.ehAdminPlataforma && !session.user.suporteAcessoId
        ? "/organizacoes"
        : "/dashboard",
    );
  }

  const h = await headers();
  const host = resolverHost(h.get("host"));
  const slugHeader = h.get(HEADER_ORG_SLUG);
  const organizationSlug =
    host.tipo === "organizacao" ? host.slug : slugHeader || null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-blue-600">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Fidelize
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {host.tipo === "plataforma"
              ? "Administração da plataforma"
              : organizationSlug
                ? `Clube de Benefícios · ${organizationSlug}`
                : "Clube de Benefícios"}
          </p>
        </div>
        <Card>
          <LoginForm
            organizationSlug={organizationSlug}
            hostTipo={host.tipo}
          />
        </Card>
      </div>
    </div>
  );
}
