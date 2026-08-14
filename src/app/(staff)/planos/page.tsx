import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { CabecalhoPagina, Card, Badge, Button } from "@/components/ui";
import { PLAN_CATALOG } from "@/lib/billing/plans";
import {
  applyPlanToOrganization,
  getOrganizationPlan,
  parsePlanCode,
} from "@/lib/billing/enforce";
import { revalidatePath } from "next/cache";
import { observabilityStatus } from "@/lib/observability";
import {
  getPlanUsage,
  issuePlanInvoice,
  listOrganizationInvoices,
  markInvoicePaid,
} from "@/lib/billing/invoices";
import { formatBRL } from "@/lib/money";
import { labelPt } from "@/lib/i18n/labels";

async function changePlanAction(formData: FormData) {
  "use server";
  const session = await requirePermission(PERMISSIONS.MODULES_MANAGE);
  const plan = parsePlanCode(String(formData.get("plan") || "trial"));
  await applyPlanToOrganization({
    organizationId: session.user.organizationId!,
    plan,
    actorId: session.user.id,
  });
  await issuePlanInvoice({
    organizationId: session.user.organizationId!,
    plan,
    notes: `Ativação do combo ${plan}`,
  }).catch(() => undefined);
  revalidatePath("/planos");
  revalidatePath("/modulos");
}

async function markInvoicePaidAction(formData: FormData) {
  "use server";
  const session = await requirePermission(PERMISSIONS.MODULES_MANAGE);
  await markInvoicePaid({
    organizationId: session.user.organizationId!,
    invoiceId: String(formData.get("invoiceId") || ""),
  });
  revalidatePath("/planos");
}

export default async function PlanosPage() {
  const session = await requirePermission(PERMISSIONS.MODULES_MANAGE);
  const orgId = session.user.organizationId!;
  const [current, obs, usageBundle, invoices] = await Promise.all([
    getOrganizationPlan(orgId),
    Promise.resolve(observabilityStatus()),
    getPlanUsage(orgId),
    listOrganizationInvoices(orgId),
  ]);

  return (
    <div>
      <CabecalhoPagina
        titulo="Combos e planos"
        descricao="Start, Pro e Vip — módulos e limites alinhados ao empacotamento comercial."
      />

      <Card className="mb-6">
        <p className="text-sm text-slate-500">Plano atual</p>
        <p className="text-2xl font-semibold">{current.catalog.name}</p>
        <p className="mt-1 text-sm text-slate-500">{current.catalog.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge>
            Usuários: {usageBundle.usage.users}
            {current.limits.maxUsers != null ? ` / ${current.limits.maxUsers}` : " · ∞"}
          </Badge>
          <Badge>
            Clínicas: {usageBundle.usage.clinics}
            {current.limits.maxClinics != null ? ` / ${current.limits.maxClinics}` : " · ∞"}
          </Badge>
          <Badge>
            Pacientes: {usageBundle.usage.patients}
            {current.limits.maxPatients != null ? ` / ${current.limits.maxPatients}` : " · ∞"}
          </Badge>
          <Badge tone={obs.sentryConfigured ? "success" : "gold"}>
            Observabilidade: {obs.sentryConfigured ? "Sentry" : "log local"}
          </Badge>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {PLAN_CATALOG.map((plan) => (
          <Card key={plan.code} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>
              </div>
              {current.planCode === plan.code ? (
                <Badge tone="success">Atual</Badge>
              ) : null}
            </div>
            <p className="mt-4 text-2xl font-semibold">
              {plan.monthlyPriceBrl == null
                ? "Sob consulta"
                : plan.monthlyPriceBrl === 0
                  ? "Grátis"
                  : `R$ ${plan.monthlyPriceBrl}/mês`}
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <form action={changePlanAction} className="mt-4">
              <input type="hidden" name="plan" value={plan.code} />
              <Button
                type="submit"
                variante={current.planCode === plan.code ? "contorno" : "gold"}
                className="w-full"
                disabled={current.planCode === plan.code}
              >
                {current.planCode === plan.code ? "Plano ativo" : "Ativar combo"}
              </Button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Faturas</h2>
        <p className="mt-2 text-sm text-slate-500">
          Registro interno do combo. A cobrança Asaas / Mercado Pago pode ser
          ligada depois.
        </p>
        <div className="mt-4 space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma fatura gerada ainda.</p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {inv.planCode} · {formatBRL(inv.amount)}
                  </p>
                  <p className="text-slate-500">
                    {inv.periodStart.toLocaleDateString("pt-BR")} –{" "}
                    {inv.periodEnd.toLocaleDateString("pt-BR")} ·{" "}
                    {labelPt(inv.status)}
                  </p>
                </div>
                {inv.status === "PENDING" ? (
                  <form action={markInvoicePaidAction}>
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <Button type="submit" tamanho="sm">
                      Marcar pago
                    </Button>
                  </form>
                ) : (
                  <Badge tone="success">{labelPt(inv.status)}</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Cobrança</h2>
        <p className="mt-2 text-sm text-slate-500">
          A cobrança recorrente (Asaas / Mercado Pago) pode ser ligada depois;
          este painel já aplica limites e módulos do combo. Variáveis sugeridas:{" "}
          <code>ASAAS_API_KEY</code>, <code>MERCADOPAGO_ACCESS_TOKEN</code>.
        </p>
      </Card>
    </div>
  );
}
