import { requireAffiliateSession } from "@/lib/auth/guards";
import { getAffiliateDashboardMetrics } from "@/lib/affiliates";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { semOrganizacao } from "@/lib/tenant";
import { CopyAffiliateLink } from "@/components/affiliates/copy-link";
import { Card } from "@/components/ui";

export default async function AfiliadoHomePage() {
  const session = await requireAffiliateSession();
  const affiliate = await semOrganizacao(() =>
    prisma.affiliate.findUniqueOrThrow({
      where: { id: session.affiliateId },
    }),
  );
  const metrics = await getAffiliateDashboardMetrics(session.affiliateId);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dominio-do-fidelize.com.br";
  const link = `${baseUrl}/?ref=${affiliate.code}`;

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm text-slate-500">Seu link exclusivo</p>
        <p className="mt-1 break-all font-mono text-sm text-slate-900 dark:text-slate-100">
          {link}
        </p>
        <div className="mt-3">
          <CopyAffiliateLink value={link} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Código: <strong>{affiliate.code}</strong> · Status: {affiliate.status}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Acessos" value={String(metrics.visits)} />
        <Metric title="Cadastros" value={String(metrics.referrals)} />
        <Metric title="Vendas confirmadas" value={String(metrics.confirmedSales)} />
        <Metric title="Conversão" value={`${metrics.conversionRate}%`} />
        <Metric title="Pendentes" value={formatBRL(metrics.pendingAmount)} />
        <Metric title="Disponível" value={formatBRL(metrics.availableAmount)} />
        <Metric title="Já pago" value={formatBRL(metrics.paidAmount)} />
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
    </Card>
  );
}
