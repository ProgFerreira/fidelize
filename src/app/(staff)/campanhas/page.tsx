import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { saveCampaignAction } from "@/app/actions";
import { campaignRoi } from "@/lib/metrics";
import { formatBRL } from "@/lib/money";

export default async function CampanhasPage() {
  const session = await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE);
  const clinicId = session.clinicId;
  const campaigns = await prisma.campaign.findMany({
    where: { clinicId: clinicId },
    orderBy: { createdAt: "desc" },
  });

  const rois = await Promise.all(
    campaigns.map(async (c) => ({ id: c.id, ...(await campaignRoi(clinicId, c.id)) })),
  );
  const roiById = Object.fromEntries(rois.map((r) => [r.id, r]));

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Cashback e pontos adicionais com público, vigência, receita e ROI."
      />

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-xl">Nova campanha</h2>
        <form action={saveCampaignAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea name="description" />
          </div>
          <div>
            <Label>Cashback extra %</Label>
            <Input name="extraCashbackPct" type="number" step="0.01" defaultValue="2" />
          </div>
          <div>
            <Label>Pontos extras</Label>
            <Input name="extraPoints" type="number" defaultValue="50" />
          </div>
          <div>
            <Label>Início</Label>
            <Input name="startsAt" type="datetime-local" />
          </div>
          <div>
            <Label>Fim</Label>
            <Input name="endsAt" type="datetime-local" />
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue="ACTIVE">
              <option value="DRAFT">Rascunho</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="ACTIVE">Ativa</option>
              <option value="ENDED">Encerrada</option>
              <option value="CANCELLED">Cancelada</option>
            </Select>
          </div>
          <div>
            <Label>Cupom</Label>
            <Input name="couponCode" />
          </div>
          <div className="md:col-span-2">
            <Label>Benefício</Label>
            <Input name="benefitDescription" />
          </div>
          <div>
            <Button type="submit" variant="gold">Salvar</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {campaigns.map((campaign) => {
          const roi = roiById[campaign.id];
          return (
            <Card key={campaign.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{campaign.name}</p>
                  <p className="text-sm text-slate-500">{campaign.description}</p>
                </div>
                <Badge tone={campaign.status === "ACTIVE" ? "success" : "muted"}>
                  {campaign.status}
                </Badge>
              </div>
              {roi ? (
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3 md:grid-cols-6">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Impactados</p>
                    <p className="font-medium text-slate-900">{roi.impacted}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Retornos</p>
                    <p className="font-medium text-slate-900">{roi.attributedVisits}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Receita</p>
                    <p className="font-medium text-slate-900">{formatBRL(roi.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Custo</p>
                    <p className="font-medium text-slate-900">
                      {formatBRL(Number(roi.benefitCost) + Number(roi.commCost))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Líquido</p>
                    <p className="font-medium text-slate-900">{formatBRL(roi.netRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">ROI</p>
                    <p className="font-medium text-slate-900">
                      {roi.roi == null ? "—" : `${roi.roi}%`}
                    </p>
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
