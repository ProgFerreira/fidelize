import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listReferrals, referralFunnel } from "@/lib/referrals";
import { prisma } from "@/lib/db";
import { CabecalhoPagina, Card, Badge, Button, Input, StatCard, Campo } from "@/components/ui";
import { saveReferralProgramAction } from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function IndicacoesPage() {
  const session = await requirePermission(PERMISSIONS.REFERRALS_MANAGE);
  const clinicId = session.clinicId;
  const [referrals, funnel, program] = await Promise.all([
    listReferrals(clinicId),
    referralFunnel(clinicId),
    prisma.referralProgram.findFirst({
      where: { clinicId: clinicId, active: true },
    }),
  ]);

  return (
    <div>
      <CabecalhoPagina
        titulo="Programa de indicação"
        descricao="Paciente indica paciente com antifraude e funil."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(funnel).map(([status, count]) => (
          <StatCard key={status} label={status} value={String(count)} />
        ))}
      </div>

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Configuração do programa</h2>
        <form action={saveReferralProgramAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Campo label="Nome" obrigatorio>
              <Input name="name" defaultValue={program?.name ?? "Indique e ganhe"} required />
            </Campo>
          </div>
          <Campo label="Cashback indicador">
            <Input name="referrerCashback" type="number" step="0.01" defaultValue={String(program?.referrerCashback ?? 50)} />
          </Campo>
          <Campo label="Pontos indicador">
            <Input name="referrerPoints" type="number" defaultValue={String(program?.referrerPoints ?? 100)} />
          </Campo>
          <Campo label="Cashback indicado">
            <Input name="referredCashback" type="number" step="0.01" defaultValue={String(program?.referredCashback ?? 30)} />
          </Campo>
          <Campo label="Pontos indicado">
            <Input name="referredPoints" type="number" defaultValue={String(program?.referredPoints ?? 50)} />
          </Campo>
          <Campo label="Valor mín. 1º atendimento">
            <Input name="minFirstAppointment" type="number" defaultValue={String(program?.minFirstAppointment ?? 100)} />
          </Campo>
          <Campo label="Prazo conversão (dias)">
            <Input name="conversionDays" type="number" defaultValue={String(program?.conversionDays ?? 90)} />
          </Campo>
          <Button type="submit" variante="gold">Salvar</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {referrals.map((ref) => (
          <Card key={ref.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {ref.referrer.fullName} → {ref.leadName ?? ref.referred?.fullName ?? "—"}
                </p>
                <p className="text-sm text-slate-500">
                  Código {ref.shortCode} · /i/{ref.shortCode}
                </p>
              </div>
              <Badge tone={ref.status === "BENEFIT_GRANTED" ? "success" : ref.status === "SUSPICIOUS" ? "danger" : "muted"}>
                {labelPt(ref.status)}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
