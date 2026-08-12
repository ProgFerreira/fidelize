import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import {
  createAffiliateAction,
  updateAffiliateStatusAction,
  confirmPlatformSaleAction,
  linkReferralAction,
  createPayoutAction,
  cancelPlatformSaleAction,
  blockCommissionAction,
  changeAffiliatePlanAction,
} from "@/app/actions/affiliates";
import {
  ensureDefaultCommissionPlan,
  getAdminAffiliateMetrics,
  listAffiliates,
  DEFAULT_PLAN_ID,
} from "@/lib/affiliates";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { semOrganizacao } from "@/lib/tenant";
import { Button, Campo, Card, Input } from "@/components/ui";

export default async function AdminAfiliadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; affiliateId?: string }>;
}) {
  await requirePlatformAdmin();
  await ensureDefaultCommissionPlan();
  const sp = await searchParams;

  const [metrics, affiliates, orgs, availableCommissions, recentSales, audits] =
    await Promise.all([
      getAdminAffiliateMetrics(),
      listAffiliates({
        q: sp.q,
        status: sp.status ? (sp.status as never) : undefined,
        type: sp.type ? (sp.type as never) : undefined,
      }),
      semOrganizacao(() =>
        prisma.organization.findMany({
          where: { deletedAt: null, slug: { not: "_plataforma" } },
          select: { id: true, name: true, slug: true, plan: true },
          orderBy: { name: "asc" },
          take: 200,
        }),
      ),
      sp.affiliateId
        ? semOrganizacao(() =>
            prisma.affiliateCommission.findMany({
              where: {
                affiliateId: sp.affiliateId,
                status: "AVAILABLE",
              },
              orderBy: { createdAt: "asc" },
              take: 50,
            }),
          )
        : Promise.resolve([]),
      semOrganizacao(() =>
        prisma.platformSale.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            organization: { select: { name: true, slug: true } },
            commissions: { select: { id: true, status: true, amount: true } },
          },
        }),
      ),
      semOrganizacao(() =>
        prisma.affiliateAuditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      ),
    ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm">
            <Link href="/organizacoes" className="text-blue-700 underline">
              ← Organizações
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Afiliados e parceiros</h1>
          <p className="text-sm text-slate-500">
            Administração comercial do programa de indicação SaaS
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Afiliados ativos" value={String(metrics.activeAffiliates)} />
        <Kpi label="Visitas" value={String(metrics.visits)} />
        <Kpi label="Cadastros" value={String(metrics.referrals)} />
        <Kpi label="Vendas" value={String(metrics.confirmedSales)} />
        <Kpi label="Receita atribuída" value={formatBRL(metrics.attributedRevenue)} />
        <Kpi label="Comissões pendentes" value={formatBRL(metrics.pendingCommissions)} />
        <Kpi label="Disponíveis" value={formatBRL(metrics.availableCommissions)} />
        <Kpi label="Pagas" value={formatBRL(metrics.paidCommissions)} />
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Novo afiliado / parceiro</h2>
        <form action={createAffiliateAction} className="grid gap-3 sm:grid-cols-2">
          <Campo label="Tipo">
            <select name="type" className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="AFFILIATE">Afiliado</option>
              <option value="PARTNER">Parceiro</option>
            </select>
          </Campo>
          <Campo label="Nome" obrigatorio>
            <Input name="name" required />
          </Campo>
          <Campo label="E-mail" obrigatorio>
            <Input name="email" type="email" required />
          </Campo>
          <Campo label="Documento">
            <Input name="document" />
          </Campo>
          <Campo label="Telefone">
            <Input name="phone" />
          </Campo>
          <Campo label="Chave Pix">
            <Input name="pixKey" />
          </Campo>
          <Campo label="Senha provisória (opcional)">
            <Input name="password" type="password" />
          </Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="termsAccepted" /> Aceite do regulamento
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Cadastrar (pendente de aprovação)</Button>
          </div>
        </form>
      </Card>

      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <Input name="q" placeholder="Buscar..." defaultValue={sp.q ?? ""} />
          <select name="status" defaultValue={sp.status ?? ""} className="rounded-md border px-2 text-sm">
            <option value="">Todos status</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className="rounded-md border px-2 text-sm">
            <option value="">Todos tipos</option>
            <option value="AFFILIATE">Afiliado</option>
            <option value="PARTNER">Parceiro</option>
          </select>
          <Button type="submit" variante="secundario">
            Filtrar
          </Button>
        </form>

        <div className="space-y-3">
          {affiliates.map((a) => (
            <div
              key={a.id}
              className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {a.name}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      {a.type} · {a.status} · ref={a.code}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.email} · plano {a.commissionPlan.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.status !== "ACTIVE" ? (
                    <form action={updateAffiliateStatusAction}>
                      <input type="hidden" name="affiliateId" value={a.id} />
                      <input type="hidden" name="status" value="ACTIVE" />
                      <Button type="submit" variante="secundario">
                        Aprovar
                      </Button>
                    </form>
                  ) : null}
                  <form action={updateAffiliateStatusAction}>
                    <input type="hidden" name="affiliateId" value={a.id} />
                    <input type="hidden" name="status" value="SUSPENDED" />
                    <input type="hidden" name="reason" value="Suspensão administrativa" />
                    <Button type="submit" variante="secundario">
                      Suspender
                    </Button>
                  </form>
                  <form action={updateAffiliateStatusAction}>
                    <input type="hidden" name="affiliateId" value={a.id} />
                    <input type="hidden" name="status" value="BLOCKED" />
                    <input type="hidden" name="reason" value="Bloqueio administrativo" />
                    <Button type="submit" variante="secundario">
                      Bloquear
                    </Button>
                  </form>
                  <form action={changeAffiliatePlanAction} className="flex flex-wrap gap-1">
                    <input type="hidden" name="affiliateId" value={a.id} />
                    <input type="hidden" name="commissionPlanId" value={DEFAULT_PLAN_ID} />
                    <input type="hidden" name="reason" value="Plano padrão aplicado" />
                    <Button type="submit" variante="secundario">
                      Plano 10%
                    </Button>
                  </form>
                  <Link
                    href={`/organizacoes/afiliados?affiliateId=${a.id}`}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    Pagar
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {affiliates.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum afiliado encontrado.</p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Vincular indicação manualmente</h2>
        <form action={linkReferralAction} className="grid gap-3 sm:grid-cols-2">
          <Campo label="Organização" obrigatorio>
            <select name="organizationId" required className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.slug})
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Código do afiliado" obrigatorio>
            <Input name="affiliateCode" required />
          </Campo>
          <Campo label="Justificativa" obrigatorio>
            <Input name="reason" required minLength={5} />
          </Campo>
          <div className="flex items-end">
            <Button type="submit">Vincular</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Registrar venda de plano (paga)</h2>
        <form action={confirmPlatformSaleAction} className="grid gap-3 sm:grid-cols-2">
          <Campo label="Organização" obrigatorio>
            <select name="organizationId" required className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.slug}) — {o.plan}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Plano" obrigatorio>
            <select name="planCode" className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="start">Start</option>
              <option value="pro">Pro</option>
              <option value="vip">Vip</option>
            </select>
          </Campo>
          <Campo label="Valor bruto (R$)" obrigatorio>
            <Input name="grossAmount" required placeholder="279.00" />
          </Campo>
          <Campo label="Desconto (R$)">
            <Input name="discountAmount" defaultValue="0" />
          </Campo>
          <Campo label="Chave de idempotência (opcional)">
            <Input name="idempotencyKey" placeholder="sale:org:start:2026-08" />
          </Campo>
          <Campo label="Observação">
            <Input name="notes" />
          </Campo>
          <div className="sm:col-span-2">
            <Button type="submit">Confirmar pagamento e gerar comissão</Button>
          </div>
        </form>
      </Card>

      {sp.affiliateId ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Pagamento ao afiliado</h2>
          <form action={createPayoutAction} className="space-y-3">
            <input type="hidden" name="affiliateId" value={sp.affiliateId} />
            {availableCommissions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma comissão disponível para este afiliado.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {availableCommissions.map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="commissionIds"
                        value={c.id}
                        defaultChecked
                      />
                      {formatBRL(c.amount)} · {c.kind} · {c.id.slice(0, 8)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Campo label="Método">
              <Input name="method" defaultValue="pix" />
            </Campo>
            <Campo label="Comprovante">
              <input type="file" name="receipt" accept="image/*,application/pdf" />
            </Campo>
            <Campo label="Observação">
              <Input name="notes" />
            </Campo>
            <Button type="submit" disabled={availableCommissions.length === 0}>
              Registrar pagamento
            </Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-lg font-medium">Vendas recentes</h2>
        <div className="space-y-2">
          {recentSales.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm dark:border-slate-800"
            >
              <div>
                <p>
                  {s.organization.name} · {s.planCode} · {s.status} ·{" "}
                  {formatBRL(s.netAmount)}
                </p>
                <p className="text-xs text-slate-500">
                  {s.commissions[0]
                    ? `Comissão ${s.commissions[0].status} ${formatBRL(s.commissions[0].amount)}`
                    : "Sem comissão"}
                </p>
              </div>
              {s.status === "CONFIRMED" ? (
                <form action={cancelPlatformSaleAction} className="flex gap-2">
                  <input type="hidden" name="saleId" value={s.id} />
                  <input type="hidden" name="reason" value="Estorno administrativo" />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="asRefund" /> reembolso
                  </label>
                  <Button type="submit" variante="secundario">
                    Cancelar/Estornar
                  </Button>
                </form>
              ) : null}
              {s.commissions[0] &&
              !["CANCELLED", "PAID"].includes(s.commissions[0].status) ? (
                <form action={blockCommissionAction}>
                  <input type="hidden" name="commissionId" value={s.commissions[0].id} />
                  <input type="hidden" name="action" value="BLOCK" />
                  <input type="hidden" name="reason" value="Análise administrativa" />
                  <Button type="submit" variante="secundario">
                    Bloquear comissão
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Auditoria recente</h2>
        <ul className="space-y-2 text-xs text-slate-600">
          {audits.map((a) => (
            <li key={a.id}>
              {a.createdAt.toLocaleString("pt-BR")} · {a.action} · {a.entityType}{" "}
              {a.entityId.slice(0, 8)}
              {a.reason ? ` — ${a.reason}` : ""}
            </li>
          ))}
          {audits.length === 0 ? <li>Sem eventos.</li> : null}
        </ul>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </Card>
  );
}
