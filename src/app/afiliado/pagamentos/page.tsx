import { requireAffiliateSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { semOrganizacao } from "@/lib/tenant";
import { Card, EmptyState } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

export default async function AfiliadoPagamentosPage() {
  const session = await requireAffiliateSession();
  const rows = await semOrganizacao(() =>
    prisma.affiliatePayout.findMany({
      where: { affiliateId: session.affiliateId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum pagamento registrado"
        descricao="Quando a plataforma liquidar suas comissões, o comprovante aparece aqui."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-medium">{formatBRL(p.totalAmount)}</p>
              <p className="text-xs text-slate-500">
                {labelPt(p.status)}
                {p.paidAt
                  ? ` · pago em ${p.paidAt.toLocaleDateString("pt-BR")}`
                  : ""}
                {p.method ? ` · ${p.method}` : ""}
              </p>
            </div>
            {p.receiptPath ? (
              <a
                href={p.receiptPath}
                className="text-sm text-blue-700 underline"
                target="_blank"
                rel="noreferrer"
              >
                Comprovante
              </a>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
