import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina, IconTag } from "@/components/ui";
import { campaignRoi } from "@/lib/metrics";
import { toClientProps } from "@/lib/serialize";
import {
  CampaignsClient,
  type CampaignDTO,
  type CampaignRoiDTO,
} from "@/components/campaigns/campaigns-client";

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
      <CabecalhoPagina
        titulo="Campanhas"
        descricao="Cashback e pontos adicionais com público, vigência, receita e ROI."
        acoes={
          <IconTag icone={Megaphone}>Marketing</IconTag>
        }
      />
      <CampaignsClient
        initialCampaigns={toClientProps<CampaignDTO[]>(campaigns)}
        initialRois={toClientProps<CampaignRoiDTO[]>(rois)}
      />
    </div>
  );
}
