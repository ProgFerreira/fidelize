import { requireAffiliateSession } from "@/lib/auth/guards";
import { maskOrgName } from "@/lib/affiliates";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { semOrganizacao } from "@/lib/tenant";
import { Card, EmptyState } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

export default async function AfiliadoIndicacoesPage() {
  const session = await requireAffiliateSession();
  const referrals = await semOrganizacao(() =>
    prisma.affiliateReferral.findMany({
      where: { affiliateId: session.affiliateId },
      include: {
        organization: { select: { id: true, name: true, plan: true, active: true } },
        commissions: {
          where: { kind: "PRIMARY" },
          select: { id: true, amount: true, status: true, platformSaleId: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );

  if (referrals.length === 0) {
    return (
      <EmptyState
        titulo="Nenhuma indicação ainda"
        descricao="Compartilhe seu link exclusivo. Quando alguém se cadastrar por ele, a indicação aparece aqui."
      />
    );
  }

  return (
    <div className="space-y-3">
      {referrals.map((r) => {
        const commission = r.commissions[0];
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {maskOrgName(r.organization.name)}
                </p>
                <p className="text-xs text-slate-500">
                  ID {r.id.slice(0, 8)} · {r.createdAt.toLocaleDateString("pt-BR")} ·{" "}
                  {r.active ? "vínculo ativo" : "inativo"} · plano{" "}
                  {r.organization.plan}
                </p>
              </div>
              <div className="text-right text-sm">
                {commission ? (
                  <>
                    <p>{formatBRL(commission.amount)}</p>
                    <p className="text-xs text-slate-500">{labelPt(commission.status)}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Sem conversão paga</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
