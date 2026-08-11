import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui";
import { campaignRoi } from "@/lib/metrics";
import { toPlain } from "@/lib/serialize";
import { CampaignsClient } from "@/components/campaigns/campaigns-client";

export default async function CampanhasPage() {
  const session = await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE);
  const clinicId = session.clinicId;
  const campaigns = await prisma.campaign.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
  });

  const rois = await Promise.all(
    campaigns.map(async (c) => ({ id: c.id, ...(await campaignRoi(clinicId, c.id)) })),
  );

  return (
    <div className="services-page">
      <PageHeader
        title="Campanhas"
        description="Cashback e pontos adicionais com público, vigência, receita e ROI."
        actions={
          <span className="services-page__pill">
            <Megaphone className="h-3.5 w-3.5" aria-hidden />
            Marketing
          </span>
        }
      />
      <CampaignsClient
        initialCampaigns={toPlain(campaigns)}
        initialRois={toPlain(rois)}
      />
    </div>
  );
}
