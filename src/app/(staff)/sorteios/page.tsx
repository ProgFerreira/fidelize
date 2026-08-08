import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listRaffles } from "@/lib/raffles";
import { PageHeader, Card, Badge, Button, Input, Label, Textarea } from "@/components/ui";
import {
  createRaffleAction,
  setRaffleStatusAction,
  drawRaffleAction,
} from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";
import { formatBRL } from "@/lib/money";

export default async function SorteiosPage() {
  const session = await requirePermission(PERMISSIONS.RAFFLES_MANAGE);
  const raffles = await listRaffles(session.clinicId);

  return (
    <div>
      <PageHeader
        title="Sorteios"
        description="Bilhetes trocados por pontos, sorteio auditado e prêmio creditado."
      />

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Novo sorteio</h2>
        <form action={createRaffleAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea name="description" />
          </div>
          <div>
            <Label>Custo em pontos</Label>
            <Input name="ticketCostPoints" type="number" defaultValue="50" />
          </div>
          <div>
            <Label>Limite por paciente</Label>
            <Input name="maxTicketsPerPatient" type="number" />
          </div>
          <div>
            <Label>Início</Label>
            <Input name="startsAt" type="datetime-local" required />
          </div>
          <div>
            <Label>Fim</Label>
            <Input name="endsAt" type="datetime-local" required />
          </div>
          <div className="md:col-span-2">
            <Label>Prêmio (descrição)</Label>
            <Input name="prizeDescription" required />
          </div>
          <div>
            <Label>Cashback prêmio</Label>
            <Input name="prizeCashback" type="number" step="0.01" />
          </div>
          <div>
            <Label>Pontos prêmio</Label>
            <Input name="prizePoints" type="number" />
          </div>
          <Button type="submit" variant="gold">Criar</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {raffles.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-slate-500">{r.prizeDescription}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {r.ticketCount} bilhetes · {r.ticketCostPoints} pts/bilhete
                  {r.prizeCashback ? ` · prêmio ${formatBRL(r.prizeCashback)}` : ""}
                </p>
              </div>
              <Badge tone={r.status === "ACTIVE" ? "success" : "muted"}>
                {labelPt(r.status)}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={setRaffleStatusAction}>
                <input type="hidden" name="raffleId" value={r.id} />
                <input
                  type="hidden"
                  name="status"
                  value={r.status === "ACTIVE" ? "CLOSED" : "ACTIVE"}
                />
                <Button type="submit" size="sm" variant="secondary">
                  {r.status === "ACTIVE" ? "Encerrar" : "Ativar"}
                </Button>
              </form>
              {r.status !== "DRAWN" ? (
                <form action={drawRaffleAction}>
                  <input type="hidden" name="raffleId" value={r.id} />
                  <Button type="submit" size="sm" variant="gold">
                    Sortear
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-emerald-700">
                  Vencedor: bilhete {r.winnerTicketId?.slice(0, 8)}…
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
