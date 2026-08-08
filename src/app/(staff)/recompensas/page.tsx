import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRewards, listRewardRedemptions } from "@/lib/rewards";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import {
  createRewardAction,
  redeemRewardAction,
  fulfillRewardAction,
} from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function RecompensasPage() {
  const session = await requirePermission(PERMISSIONS.REWARDS_MANAGE);
  const clinicId = session.clinicId;
  const [rewards, redemptions, patients] = await Promise.all([
    listRewards(clinicId),
    listRewardRedemptions(clinicId),
    prisma.patient.findMany({
      where: { clinicId: clinicId, status: "ACTIVE" },
      select: { id: true, fullName: true },
      take: 100,
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Catálogo de recompensas"
        description="Troca de pontos com estoque e confirmação na recepção."
      />
      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Nova recompensa</h2>
        <form action={createRewardAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Pontos</Label>
            <Input name="pointsCost" type="number" required defaultValue="100" />
          </div>
          <div>
            <Label>Estoque</Label>
            <Input name="stockTotal" type="number" />
          </div>
          <div>
            <Label>Limite/paciente</Label>
            <Input name="limitPerPatient" type="number" defaultValue="1" />
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Ativa</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PAUSED">Pausada</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea name="description" />
          </div>
          <Button type="submit" variant="gold">Salvar</Button>
        </form>
      </Card>

      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold">{reward.name}</p>
                <p className="text-sm text-slate-500">{reward.pointsCost} pontos</p>
              </div>
              <Badge tone={reward.status === "ACTIVE" ? "success" : "muted"}>
                {labelPt(reward.status)}
              </Badge>
            </div>
            <form action={redeemRewardAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="rewardId" value={reward.id} />
              <Select name="patientId" required className="min-w-[180px]">
                <option value="">Paciente</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
              <Button type="submit" size="sm">Resgatar</Button>
            </form>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Resgates</h2>
      <div className="space-y-3">
        {redemptions.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {r.patient.fullName} · {r.reward.name}
                </p>
                <p className="text-sm text-slate-500">
                  Código {r.code} · {r.pointsSpent} pts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === "FULFILLED" ? "success" : "warning"}>
                  {labelPt(r.status)}
                </Badge>
                {r.status === "PENDING_FULFILLMENT" && (
                  <form action={fulfillRewardAction}>
                    <input type="hidden" name="redemptionId" value={r.id} />
                    <Button type="submit" size="sm">Confirmar entrega</Button>
                  </form>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
