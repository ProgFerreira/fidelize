import { CabecalhoPagina, Card } from "@/components/ui";
import { requireSession } from "@/lib/auth/guards";
import { labelPt } from "@/lib/i18n/labels";
import Link from "next/link";

export default async function ContaPage() {
  const session = await requireSession();

  return (
    <div className="max-w-lg space-y-6">
      <CabecalhoPagina
        titulo="Minha conta"
        descricao="Seus dados de acesso ao painel."
      />
      <Card className="space-y-3 text-sm">
        <p>
          <strong>Nome:</strong> {session.user.name ?? "—"}
        </p>
        <p>
          <strong>E-mail:</strong> {session.user.email ?? "—"}
        </p>
        <p>
          <strong>Papel:</strong> {labelPt(session.user.roleCode)}
        </p>
      </Card>
      <Card className="space-y-2">
        <h2 className="text-base font-semibold">Senha</h2>
        <p className="text-sm text-slate-500">
          Enviamos um link seguro para o seu e-mail quando você pede a
          redefinição.
        </p>
        <Link
          href="/recuperar-senha"
          className="text-sm font-medium text-brand-navy underline"
        >
          Redefinir senha
        </Link>
      </Card>
    </div>
  );
}
