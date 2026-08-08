import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPatientSession } from "@/lib/otp/session";
import { formatBRL } from "@/lib/money";
import { getCategoryProgress } from "@/lib/categories";
import { generateCardQrDataUrl } from "@/lib/cards";
import { Badge, Card } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";

export default async function PatientHomePage() {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

  const patient = await prisma.patient.findFirst({
    where: { id: session.patientId, clinicId: session.clinicId },
    include: {
      wallets: {
        where: { status: "ACTIVE" },
        include: {
          category: true,
          cards: { where: { status: "ACTIVE" } },
          ledgerEntries: { orderBy: { createdAt: "desc" }, take: 5 },
          creditLots: {
            where: {
              status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
              remainingAmount: { gt: 0 },
            },
            orderBy: { expiresAt: "asc" },
            take: 3,
          },
        },
      },
    },
  });

  const wallet = patient?.wallets[0];
  if (!wallet) {
    return <p>Carteira não encontrada.</p>;
  }

  const progress = await getCategoryProgress(wallet.id);
  const card = wallet.cards[0];
  const qr = card ? await generateCardQrDataUrl(card.publicToken) : null;

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="digital-card">
        <p className="text-xs uppercase tracking-[0.25em] text-blue-200">
          Cartão digital
        </p>
        <h1 className="mt-6 text-3xl">{patient?.fullName}</h1>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Categoria</p>
            <p className="text-lg font-semibold text-blue-600">
              {wallet.category?.name ?? "—"}
            </p>
            <p className="mt-2 font-mono text-sm text-white/70">
              {card?.cardNumber ?? "Sem cartão"}
            </p>
          </div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code" className="h-24 w-24 rounded-xl bg-white p-1" />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-slate-500">Disponível</p>
          <p className="text-2xl">{formatBRL(wallet.availableBalance)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Pontos</p>
          <p className="text-2xl">{wallet.pointsBalance}</p>
        </Card>
      </div>

      {progress?.next ? (
        <Card>
          <p className="text-sm text-slate-500">
            Progresso para {progress.next.name}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-semibold">{progress.progressPercent}%</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-xl">Últimas movimentações</h2>
        <div className="mt-3 space-y-2">
          {wallet.ledgerEntries.map((entry) => (
            <div key={entry.id} className="flex justify-between text-sm">
              <span>{labelPt(entry.type)}</span>
              <span className="font-semibold">{formatBRL(entry.amount)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl">Próximos a expirar</h2>
        <div className="mt-3 space-y-2">
          {wallet.creditLots.map((lot) => (
            <div key={lot.id} className="flex items-center justify-between text-sm">
              <span>{formatBRL(lot.remainingAmount)}</span>
              <Badge tone="gold">
                {lot.expiresAt?.toLocaleDateString("pt-BR") ?? "—"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
