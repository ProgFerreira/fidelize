import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listAccelerators } from "@/lib/accelerators";
import { PageHeader, Card, Badge, Button, Input, Label } from "@/components/ui";
import { createAcceleratorAction } from "@/app/v2-actions";

export default async function AceleradoresPage() {
  const session = await requirePermission(PERMISSIONS.ACCELERATORS_MANAGE);
  const clinicId = session.clinicId;
  const rules = await listAccelerators(clinicId);
  const now = new Date();
  const start = new Date(now.getTime() - 3600000).toISOString().slice(0, 16);
  const end = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 16);

  return (
    <div>
      <PageHeader
        title="Aceleradores"
        description="Multiplicadores temporários de pontos e cashback."
      />
      <Card className="mb-6 max-w-3xl">
        <form action={createAcceleratorAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input name="name" required defaultValue="Pontos em dobro" />
          </div>
          <div>
            <Label>Multiplicador de pontos</Label>
            <Input name="multiplierPoints" type="number" step="0.1" defaultValue="2" />
          </div>
          <div>
            <Label>Cashback extra %</Label>
            <Input name="extraCashbackPct" type="number" step="0.01" />
          </div>
          <div>
            <Label>Bônus fixo</Label>
            <Input name="bonusFixed" type="number" step="0.01" />
          </div>
          <div>
            <Label>Teto financeiro</Label>
            <Input name="financialCap" type="number" step="0.01" />
          </div>
          <div>
            <Label>Início</Label>
            <Input name="startsAt" type="datetime-local" defaultValue={start} required />
          </div>
          <div>
            <Label>Fim</Label>
            <Input name="endsAt" type="datetime-local" defaultValue={end} required />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="stackable" />
            Combinável com outros aceleradores
          </label>
          <Button type="submit" variant="gold">Ativar acelerador</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{rule.name}</p>
                <p className="text-sm text-slate-500">
                  {rule.multiplierPoints ? `x${rule.multiplierPoints} pts` : ""}
                  {rule.extraCashbackPct ? ` · +${rule.extraCashbackPct}%` : ""}
                  {rule.financialCap ? ` · teto R$ ${Number(rule.financialCap).toFixed(2)}` : ""}
                </p>
              </div>
              <Badge tone={rule.active ? "success" : "muted"}>
                {rule.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
