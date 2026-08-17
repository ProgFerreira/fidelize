import { Gift } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  listRewards,
  listRewardRedemptions,
  type RewardDTO,
  type RewardRedemptionDTO,
} from "@/lib/rewards";
import { prisma } from "@/lib/db";
import { CabecalhoPagina, IconTag } from "@/components/ui";
import { RewardsClient } from "@/components/rewards/rewards-client";
import { toPlain } from "@/lib/serialize";

export default async function RecompensasPage() {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  const clinicId = session.clinicId;
  const [rewards, redemptions, patients] = await Promise.all([
    listRewards(clinicId),
    listRewardRedemptions(clinicId),
    prisma.patient.findMany({
      where: { clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      take: 100,
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="services-page">
      <CabecalhoPagina
        titulo="Recompensas"
        descricao="Catálogo de trocas por pontos — estoque, limites e confirmação na recepção."
        acoes={
          <IconTag icone={Gift}>Pontos</IconTag>
        }
      />
      <RewardsClient
        initialRewards={toPlain(rewards) as RewardDTO[]}
        initialRedemptions={toPlain(redemptions) as RewardRedemptionDTO[]}
        patients={toPlain(patients)}
        canFulfill={hasPermission(
          session.user.permissions,
          PERMISSIONS.REWARDS_FULFILL,
        )}
      />
    </div>
  );
}
