import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listGiftCards } from "@/lib/giftcards";
import { PageHeader, Card, Badge, Button, Input, Label } from "@/components/ui";
import {
  issueGiftCardAction,
  activateGiftCardAction,
  redeemGiftCardAction,
} from "@/app/v2-actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function ValesPresentePage() {
  const session = await requirePermission(PERMISSIONS.GIFTCARDS_MANAGE);
  const clinicId = session.clinicId;
  const cards = await listGiftCards(clinicId);

  return (
    <div>
      <PageHeader
        title="Vales-presente"
        description="Pré-pago digital separado do saldo promocional."
      />
      <Card className="mb-6 max-w-3xl">
        <form action={issueGiftCardAction} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Valor</Label>
            <Input name="initialAmount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Comprador</Label>
            <Input name="buyerName" />
          </div>
          <div>
            <Label>Beneficiário</Label>
            <Input name="beneficiaryName" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Input name="message" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="activate" defaultChecked />
            Ativar imediatamente
          </label>
          <Button type="submit" variant="gold">Emitir</Button>
        </form>
      </Card>

      <Card className="mb-6 max-w-3xl">
        <h2 className="text-lg font-semibold">Usar vale</h2>
        <form action={redeemGiftCardAction} className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <Label>Código</Label>
            <Input name="code" required />
          </div>
          <div>
            <Label>Valor</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div className="flex items-end">
            <Button type="submit">Debitar</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {cards.map((card) => (
          <Card key={card.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{card.code}</p>
                <p className="text-sm text-slate-500">
                  {card.beneficiaryName ?? "—"} · restante R${" "}
                  {Number(card.remainingAmount).toFixed(2)} /{" "}
                  {Number(card.initialAmount).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={card.status === "ACTIVE" ? "success" : "muted"}>
                  {labelPt(card.status)}
                </Badge>
                {card.status === "PENDING_PAYMENT" && (
                  <form action={activateGiftCardAction}>
                    <input type="hidden" name="giftCardId" value={card.id} />
                    <Button type="submit" size="sm">Ativar</Button>
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
