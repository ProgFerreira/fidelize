import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ReceptionClient } from "@/components/reception/reception-client";
import { listProfessionals } from "@/lib/professionals";
import { toPlain } from "@/lib/serialize";
import { isModuleEnabled } from "@/lib/modules";
import { getReceptionKpi } from "@/lib/reception/kpi";

export default async function RecepcaoPage() {
  const session = await requirePermission(PERMISSIONS.RECEPTION_OPERATE);
  const clinicId = session.clinicId;

  const [procedures, professionals, campaigns, availableCards, giftCardEnabled, kpi] =
    await Promise.all([
      prisma.procedure.findMany({
        where: { clinicId, active: true },
        orderBy: { name: "asc" },
      }),
      listProfessionals({ clinicId, activeOnly: true }),
      prisma.campaign.findMany({
        where: { clinicId, status: "ACTIVE" },
        orderBy: { name: "asc" },
      }),
      prisma.card.findMany({
        where: { clinicId, status: "AVAILABLE" },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      isModuleEnabled(clinicId, "GIFT_CARD"),
      getReceptionKpi(clinicId),
    ]);

  return (
    <div>
      <ReceptionClient
        procedures={toPlain(
          procedures.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            basePrice: Number(p.basePrice),
            description: p.description,
            validityDays: p.validityDays,
            durationMinutes: p.durationMinutes,
            cashbackPercent:
              p.cashbackPercent == null ? null : Number(p.cashbackPercent),
            packageSessions: p.packageSessions,
          })),
        )}
        professionals={toPlain(
          professionals.map((p) => ({
            id: p.id,
            name: p.name,
            specialty: p.specialty,
            procedureIds: p.procedureIds,
            procedurePrices: p.procedurePrices,
          })),
        )}
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
        giftCardEnabled={giftCardEnabled}
        kpi={kpi}
      />
    </div>
  );
}
