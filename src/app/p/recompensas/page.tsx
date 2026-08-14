import { requirePatientSession } from "@/lib/otp/session";
import { listRewards } from "@/lib/rewards";
import { isModuleEnabled } from "@/lib/modules";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, Button } from "@/components/ui";
import { redeemReward } from "@/lib/rewards";
import { randomUUID } from "crypto";
import { labelPt } from "@/lib/i18n/labels";

async function redeemAction(formData: FormData) {
  "use server";
  const session = await requirePatientSession();
  await redeemReward({
    clinicId: session.clinicId,
    patientId: session.patientId,
    rewardId: String(formData.get("rewardId")),
    idempotencyKey: randomUUID(),
  });
}

export default async function PortalRecompensasPage() {
  const session = await requirePatientSession();

  if (!(await isModuleEnabled(session.clinicId, "REWARDS"))) {
    return (
      <div>
        <PageHeader title="Recompensas" description="Módulo desativado no momento." />
      </div>
    );
  }

  const [rewards, wallet] = await Promise.all([
    listRewards(session.clinicId),
    prisma.wallet.findFirst({
      where: { clinicId: session.clinicId, patientId: session.patientId },
    }),
  ]);

  const active = rewards.filter((r) => r.status === "ACTIVE");

  return (
    <div>
      <PageHeader
        title="Recompensas"
        description={`Seus pontos: ${wallet?.pointsBalance ?? 0}`}
      />
      <div className="grid gap-3">
        {active.map((reward) => (
          <Card key={reward.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{reward.name}</p>
                <p className="text-sm text-slate-500">{reward.description}</p>
                <p className="mt-1 text-sm">{reward.pointsCost} pontos</p>
              </div>
              <Badge tone="muted">{labelPt(reward.status)}</Badge>
            </div>
            <form action={redeemAction} className="mt-3">
              <input type="hidden" name="rewardId" value={reward.id} />
              <Button
                type="submit"
                size="sm"
                disabled={(wallet?.pointsBalance ?? 0) < reward.pointsCost}
              >
                Resgatar
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
