import { requireAffiliateSession } from "@/lib/auth/guards";
import { updateAffiliateProfileAction } from "@/app/actions/affiliates";
import { prisma } from "@/lib/db";
import { semOrganizacao } from "@/lib/tenant";
import { Button, Campo, Card, Input } from "@/components/ui";

export default async function AfiliadoPerfilPage() {
  const session = await requireAffiliateSession();
  const affiliate = await semOrganizacao(() =>
    prisma.affiliate.findUniqueOrThrow({ where: { id: session.affiliateId } }),
  );

  return (
    <Card>
      <h2 className="mb-4 text-lg font-medium">Dados cadastrais e pagamento</h2>
      <form action={updateAffiliateProfileAction} className="grid max-w-lg gap-3">
        <Campo label="Nome">
          <Input name="name" defaultValue={affiliate.name} />
        </Campo>
        <Campo label="Telefone">
          <Input name="phone" defaultValue={affiliate.phone ?? ""} />
        </Campo>
        <Campo label="Chave Pix">
          <Input name="pixKey" defaultValue={affiliate.pixKey ?? ""} />
        </Campo>
        <Campo label="Observações de pagamento">
          <Input name="payoutNotes" defaultValue={affiliate.payoutNotes ?? ""} />
        </Campo>
        <p className="text-xs text-slate-500">
          E-mail e documento não podem ser alterados aqui. Alterações sensíveis
          são auditadas.
        </p>
        <Button type="submit">Salvar</Button>
      </form>
    </Card>
  );
}
