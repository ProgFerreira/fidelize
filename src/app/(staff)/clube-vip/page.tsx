import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import {
  CabecalhoPagina,
  Card,
  Badge,
  Button,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import {
  confirmMembershipPaymentAction,
  subscribeMembershipAction,
  upsertMembershipPlanAction,
} from "@/app/membership-actions";
import {
  listClinicMemberships,
  listMembershipPlans,
} from "@/lib/membership";
import { labelPt } from "@/lib/i18n/labels";

export default async function ClubeVipPage() {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const clinicId = session.clinicId;
  const [plans, memberships, patients] = await Promise.all([
    listMembershipPlans(clinicId),
    listClinicMemberships(clinicId),
    prisma.patient.findMany({
      where: { clinicId, status: { not: "BLOCKED" }, holderPatientId: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Clube VIP"
        descricao="Planos mensais com cashback extra. PIX fica pendente até a recepção confirmar."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Novo plano</h2>
          <form action={upsertMembershipPlanAction} className="mt-3 grid gap-3">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required placeholder="Clube VIP" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="monthlyPrice">Mensalidade (R$)</Label>
                <Input
                  id="monthlyPrice"
                  name="monthlyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue="99"
                />
              </div>
              <div>
                <Label htmlFor="extraCashbackPct">Cashback extra %</Label>
                <Input
                  id="extraCashbackPct"
                  name="extraCashbackPct"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  defaultValue="2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="courtesyNote">Cortesia / observações</Label>
              <Textarea id="courtesyNote" name="courtesyNote" rows={2} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked />
              Plano ativo
            </label>
            <Button type="submit" variante="gold">
              Salvar plano
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Ativar membro</h2>
          <form action={subscribeMembershipAction} className="mt-3 grid gap-3">
            <div>
              <Label htmlFor="patientId">Paciente titular</Label>
              <Select id="patientId" name="patientId" required defaultValue="">
                <option value="">Selecione</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="planId">Plano</Label>
              <Select id="planId" name="planId" required defaultValue="">
                <option value="">Selecione</option>
                {plans
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatBRL(p.monthlyPrice)} · +
                      {Number(p.extraCashbackPct)}%
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="paidMethod">Pagamento</Label>
              <Select id="paidMethod" name="paidMethod" defaultValue="PIX">
                <option value="PIX">PIX (pendente)</option>
                <option value="DINHEIRO">Dinheiro (ativo já)</option>
                <option value="CORTESIA">Cortesia</option>
              </Select>
            </div>
            <Button type="submit">Ativar / registrar</Button>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold">Planos</h2>
        <div className="mt-3 space-y-2">
          {plans.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum plano cadastrado.</p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-slate-500">
                    {formatBRL(plan.monthlyPrice)} / mês · +
                    {Number(plan.extraCashbackPct)}% cashback
                  </p>
                </div>
                <Badge tone={plan.active ? "success" : "gold"}>
                  {plan.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Assinaturas</h2>
        <div className="mt-3 space-y-2">
          {memberships.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma assinatura ainda.</p>
          ) : (
            memberships.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{row.patient.fullName}</p>
                  <p className="text-slate-500">
                    {row.plan.name} · {labelPt(row.status)} · renova{" "}
                    {row.renewsAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {row.status === "PENDING" ? (
                  <form action={confirmMembershipPaymentAction}>
                    <input type="hidden" name="membershipId" value={row.id} />
                    <Button type="submit" tamanho="sm" variante="gold">
                      Confirmar PIX
                    </Button>
                  </form>
                ) : (
                  <Badge tone={row.status === "ACTIVE" ? "success" : "gold"}>
                    {labelPt(row.status)}
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
