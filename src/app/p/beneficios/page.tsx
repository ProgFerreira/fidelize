import { prisma } from "@/lib/db";
import { requirePatientSession } from "@/lib/otp/session";
import { Card, Badge } from "@/components/ui";

export default async function BeneficiosPage() {
  const session = await requirePatientSession();

  const [wallet, campaigns] = await Promise.all([
    prisma.wallet.findFirst({
      where: { patientId: session.patientId, clinicId: session.clinicId },
      include: { category: true },
    }),
    prisma.campaign.findMany({
      where: { clinicId: session.clinicId, status: "ACTIVE" },
      orderBy: { startsAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-slate-900">Benefícios</h1>
      <Card>
        <h2 className="text-xl">
          Categoria {wallet?.category?.name ?? "—"}
        </h2>
        <p className="mt-2 text-sm text-slate-500 whitespace-pre-wrap">
          {wallet?.category?.benefits ?? "Benefícios da categoria."}
        </p>
        <p className="mt-3 text-sm">
          Cashback {String(wallet?.category?.cashbackPercent ?? 0)}% · Desconto{" "}
          {String(wallet?.category?.discountPercent ?? 0)}%
        </p>
      </Card>

      <div className="space-y-3">
        <h2 className="text-xl">Campanhas ativas</h2>
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{campaign.name}</p>
                <p className="text-sm text-slate-500">{campaign.description}</p>
                <p className="mt-2 text-sm">
                  +{String(campaign.extraCashbackPct)}% cashback · +
                  {campaign.extraPoints} pontos
                </p>
              </div>
              <Badge tone="gold">Ativa</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
