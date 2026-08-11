import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Badge } from "@/components/ui";
import { getBenefitSettings } from "@/lib/cashback";
import { SettingsForm } from "@/components/settings/settings-form";
import { CategoryPlanCard } from "@/components/settings/category-plan-card";
import { Building2, MapPin } from "lucide-react";
import { updateCustomDomainAction } from "@/app/v2-actions";
import { Button, Input, Label } from "@/components/ui";

export default async function ConfiguracoesPage() {
  const session = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const clinicId = session.clinicId;
  const [settings, categories, clinic, units, procedures] = await Promise.all([
    getBenefitSettings(clinicId),
    prisma.category.findMany({
      where: { clinicId: clinicId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.clinic.findUnique({ where: { id: clinicId } }),
    prisma.unit.findMany({ where: { clinicId: clinicId } }),
    prisma.procedure.findMany({
      where: { clinicId: clinicId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Regras comerciais e planos de relacionamento da clínica."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700">
              <Building2 className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">Clínica</h2>
              <p className="mt-1 font-medium text-slate-800">{clinic?.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {clinic?.email}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Fuso: {clinic?.timezone}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-600">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {units.length} unidade{units.length === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Slug: {clinic?.slug ?? "—"}
              </p>
            </div>
          </div>
          <form action={updateCustomDomainAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <Label>Domínio personalizado do portal</Label>
            <Input
              name="customDomain"
              placeholder="fidelidade.suaclinica.com.br"
              defaultValue={clinic?.customDomain ?? ""}
            />
            <p className="text-xs text-slate-500">
              Aponte o DNS (CNAME) para este host e use HTTPS. O portal do
              paciente resolve por <code>customDomain</code> ou subdomain do slug.
            </p>
            <Button type="submit" size="sm" variant="secondary">
              Salvar domínio
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">
            Regras gerais
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Percentuais e prazos padrão — nunca fixos no código.
          </p>
          <SettingsForm initial={settings} />
        </Card>
      </div>

      <section className="settings-section">
        <div className="mb-4">
          <h2 className="settings-section__title">Planos de relacionamento</h2>
          <p className="settings-section__desc">
            Categorias Bronze a Diamante — cada plano com cashback, requisitos e
            benefícios próprios.
          </p>
        </div>

        <div className="plans-grid">
          {categories.map((category) => (
            <CategoryPlanCard
              key={category.id}
              category={{
                ...category,
                cashbackPercent: String(category.cashbackPercent),
                discountPercent: String(category.discountPercent),
                minAnnualSpend: String(category.minAnnualSpend),
              }}
            />
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="settings-section__title">Serviços / procedimentos</h2>
            <p className="settings-section__desc">
              Catálogo de produtos de atendimento (valor, descrição e validade).
              Cadastro completo em Serviços.
            </p>
          </div>
          <a
            href="/servicos"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Abrir catálogo →
          </a>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-slate-100">
            {procedures.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Nenhum serviço cadastrado.{" "}
                <a href="/servicos" className="text-blue-600 hover:underline">
                  Cadastrar agora
                </a>
              </p>
            ) : (
              procedures.slice(0, 8).map((procedure) => (
                <div
                  key={procedure.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-900">
                      {procedure.name}
                    </span>
                    <span className="ml-2 text-slate-400">{procedure.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-slate-700">
                      R$ {Number(procedure.basePrice).toFixed(2)}
                    </span>
                    {procedure.validityDays != null ? (
                      <Badge tone="muted">
                        {procedure.validityDays}d validade
                      </Badge>
                    ) : null}
                    {procedure.cashbackPercent != null ? (
                      <Badge tone="gold">
                        {String(procedure.cashbackPercent)}% cashback
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
