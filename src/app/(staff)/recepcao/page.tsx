import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui";
import { ReceptionClient } from "@/components/reception/reception-client";

export default async function RecepcaoPage() {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const clinicId = session.clinicId;

  const [procedures, campaigns, availableCards] = await Promise.all([
    prisma.procedure.findMany({
      where: { clinicId: clinicId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: { clinicId: clinicId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.card.findMany({
      where: { clinicId: clinicId, status: "AVAILABLE" },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Recepção"
        description="Fluxo rápido: localizar paciente, simular benefício e confirmar atendimento."
      />
      <ReceptionClient
        procedures={procedures.map((p) => ({
          id: p.id,
          name: p.name,
          basePrice: Number(p.basePrice),
        }))}
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          extraCashbackPct: Number(c.extraCashbackPct),
        }))}
        availableCards={availableCards.map((c) => ({
          id: c.id,
          cardNumber: c.cardNumber,
          publicToken: c.publicToken,
        }))}
      />
    </div>
  );
}
