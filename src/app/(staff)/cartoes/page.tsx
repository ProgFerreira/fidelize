import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Card, Badge, Button, Input, Label, Select } from "@/components/ui";
import { createCardStockAction, blockCardAction } from "@/app/actions";
import { labelPt } from "@/lib/i18n/labels";

export default async function CartoesPage() {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const clinicId = session.clinicId;
  const [cards, units] = await Promise.all([
    prisma.card.findMany({
      where: { clinicId: clinicId },
      include: { wallet: { include: { patient: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.unit.findMany({ where: { clinicId: clinicId, active: true } }),
  ]);

  const counts = {
    AVAILABLE: cards.filter((c) => c.status === "AVAILABLE").length,
    ACTIVE: cards.filter((c) => c.status === "ACTIVE").length,
    BLOCKED: cards.filter((c) => c.status === "BLOCKED").length,
  };

  return (
    <div>
      <PageHeader
        title="Cartões"
        description="Estoque físico, vínculo e bloqueio. QR contém apenas token seguro."
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-slate-500">Disponíveis</p><p className="text-3xl">{counts.AVAILABLE}</p></Card>
        <Card><p className="text-sm text-slate-500">Ativos</p><p className="text-3xl">{counts.ACTIVE}</p></Card>
        <Card><p className="text-sm text-slate-500">Bloqueados</p><p className="text-3xl">{counts.BLOCKED}</p></Card>
      </div>

      <Card className="mb-4 max-w-xl">
        <h2 className="text-xl">Gerar estoque</h2>
        <form action={createCardStockAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Quantidade</Label>
            <Input name="quantity" type="number" min={1} defaultValue={10} required />
          </div>
          <div>
            <Label>Unidade</Label>
            <Select name="unitId" defaultValue="">
              <option value="">Todas</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="gold">Gerar</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {cards.map((card) => (
          <Card key={card.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{card.cardNumber}</p>
                <p className="text-sm text-slate-500">
                  Token {card.publicToken.slice(0, 8)}… ·{" "}
                  {card.wallet?.patient?.fullName ?? "Sem vínculo"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={card.status === "ACTIVE" ? "success" : card.status === "BLOCKED" ? "danger" : "muted"}>
                  {labelPt(card.status)}
                </Badge>
                {card.status === "ACTIVE" || card.status === "AVAILABLE" ? (
                  <form action={blockCardAction} className="flex gap-2">
                    <input type="hidden" name="cardId" value={card.id} />
                    <Input name="reason" placeholder="Motivo" required />
                    <Button type="submit" variant="danger">Bloquear</Button>
                  </form>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
