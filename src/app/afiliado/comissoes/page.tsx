import { requireAffiliateSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { semOrganizacao } from "@/lib/tenant";
import { Card, EmptyState } from "@/components/ui";

const STATUS_HELP: Record<string, string> = {
  PENDING: "Aguardando prazo de segurança",
  APPROVED: "Aprovada",
  AVAILABLE: "Disponível para pagamento",
  PAID: "Paga",
  CANCELLED: "Cancelada",
  BLOCKED: "Retida para análise",
};

export default async function AfiliadoComissoesPage() {
  const session = await requireAffiliateSession();
  const rows = await semOrganizacao(() =>
    prisma.affiliateCommission.findMany({
      where: { affiliateId: session.affiliateId },
      include: { platformSale: { select: { planCode: true, confirmedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        titulo="Nenhuma comissão registrada"
        descricao="Quando uma indicação converter em venda, a comissão aparece nesta lista."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-medium">
                {c.kind === "ADJUSTMENT" ? "Ajuste" : "Comissão"} ·{" "}
                {c.platformSale.planCode}
              </p>
              <p className="text-xs text-slate-500">
                {c.createdAt.toLocaleDateString("pt-BR")} · base{" "}
                {formatBRL(c.baseAmount)} · {STATUS_HELP[c.status] || c.status}
              </p>
              {c.availableAt ? (
                <p className="text-xs text-slate-500">
                  Liberação prevista: {c.availableAt.toLocaleDateString("pt-BR")}
                </p>
              ) : null}
              {c.cancelReason ? (
                <p className="text-xs text-red-600">Motivo: {c.cancelReason}</p>
              ) : null}
            </div>
            <p className="text-lg font-semibold">{formatBRL(c.amount)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
