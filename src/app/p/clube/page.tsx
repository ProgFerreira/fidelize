import { requirePatientSession } from "@/lib/otp/session";
import { getActiveMembership, listMembershipPlans } from "@/lib/membership";
import { formatBRL } from "@/lib/money";
import { CabecalhoPagina, Card, Badge } from "@/components/ui";

export default async function PortalClubePage() {
  const session = await requirePatientSession();
  const [plans, membership] = await Promise.all([
    listMembershipPlans(session.clinicId, true),
    getActiveMembership(session.clinicId, session.patientId),
  ]);

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Clube VIP"
        descricao="Cashback extra mensal. A recepção ativa o plano após o pagamento."
      />
      {membership ? (
        <Card>
          <Badge tone="success">Ativo</Badge>
          <p className="mt-2 text-xl font-semibold">{membership.plan.name}</p>
          <p className="text-sm text-slate-500">
            +{Number(membership.plan.extraCashbackPct)}% de cashback · renova em{" "}
            {membership.renewsAt.toLocaleDateString("pt-BR")}
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-slate-600">
            Você ainda não está no clube mensal. Peça na recepção para ativar.
          </p>
        </Card>
      )}
      {plans.map((plan) => (
        <Card key={plan.id}>
          <p className="font-semibold">{plan.name}</p>
          <p className="text-2xl">{formatBRL(plan.monthlyPrice)}/mês</p>
          <p className="text-sm text-slate-500">
            +{Number(plan.extraCashbackPct)}% de cashback em cada atendimento
          </p>
          {plan.courtesyNote ? (
            <p className="mt-2 text-sm">{plan.courtesyNote}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
