import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePatientSession } from "@/lib/otp/session";
import { formatBRL } from "@/lib/money";
import { getCategoryProgress } from "@/lib/categories";
import { generateCardQrDataUrl } from "@/lib/cards";
import { Badge, Card, classesBotao } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";
import { resolveBenefitWallet } from "@/lib/family";

export default async function PatientHomePage() {
  const session = await requirePatientSession();

  const family = await resolveBenefitWallet({
    clinicId: session.clinicId,
    patientId: session.patientId,
  }).catch(() => null);

  const patient = await prisma.patient.findFirst({
    where: { id: session.patientId, clinicId: session.clinicId },
    include: {
      wallets: {
        where: family
          ? { id: family.wallet.id }
          : { status: "ACTIVE" },
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

  let wallet = patient?.wallets[0];
  if (!wallet && family) {
    wallet = await prisma.wallet.findFirst({
      where: { id: family.wallet.id },
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
    }) ?? undefined;
  }
  if (!wallet) {
    return <p>Carteira não encontrada.</p>;
  }

  const progress = await getCategoryProgress(wallet.id);
  const card =
    wallet.cards.find((c) => c.kind === "VIRTUAL") ??
    wallet.cards.find((c) => c.kind === "PHYSICAL") ??
    wallet.cards[0];
  const qr = card ? await generateCardQrDataUrl(card.publicToken) : null;
  const firstName = patient?.fullName.split(" ")[0] ?? "você";

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="digital-card">
        <p className="text-xs uppercase tracking-[0.25em] text-blue-200">
          Seu cartão fidelidade
        </p>
        <h1 className="mt-4 text-3xl">Olá, {firstName}</h1>
        <p className="mt-2 text-sm text-white/70">
          {wallet.category?.name ?? "Membro"} ·{" "}
          {card?.cardNumber ?? "Sem cartão ativo"}
        </p>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Saldo cashback</p>
            <p className="text-3xl font-semibold tabular">
              {formatBRL(wallet.availableBalance)}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {wallet.pointsBalance} pontos
            </p>
          </div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR Code do cartão"
              className="h-24 w-24 rounded-xl bg-white p-1"
            />
          ) : null}
        </div>
        {progress?.next ? (
          <div className="mt-6">
            <p className="text-xs text-white/60">
              Próximo nível: {progress.next.name}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-blue-400"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-white/70">
              {progress.progressPercent}% do caminho
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/p/agendar" className={classesBotao({ variante: "gold", className: "w-full" })}>
          Agendar
        </Link>
        <Link href="/p/recompensas" className={classesBotao({ variante: "secundario", className: "w-full" })}>
          Resgatar
        </Link>
        <Link href="/p/indicacoes" className={classesBotao({ variante: "contorno", className: "w-full" })}>
          Indicar
        </Link>
        <Link href="/p/clube" className={classesBotao({ variante: "contorno", className: "w-full" })}>
          Clube VIP
        </Link>
        <Link href="/p/regulamento" className={classesBotao({ variante: "contorno", className: "w-full" })}>
          Regulamento
        </Link>
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

      <Card>
        <h2 className="text-xl">Últimas movimentações</h2>
        <div className="mt-3 space-y-2">
          {wallet.ledgerEntries.length === 0 ? (
            <p className="text-sm text-slate-500">
              Compras, cashback e resgates aparecem aqui.
            </p>
          ) : (
            wallet.ledgerEntries.map((entry) => (
              <div key={entry.id} className="flex justify-between text-sm">
                <span>{labelPt(entry.type)}</span>
                <span className="font-semibold">{formatBRL(entry.amount)}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-xl">Próximos a expirar</h2>
        <div className="mt-3 space-y-2">
          {wallet.creditLots.length === 0 ? (
            <p className="text-sm text-slate-500">
              Quando houver cashback com validade, ele aparece nesta lista.
            </p>
          ) : (
            wallet.creditLots.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{formatBRL(lot.remainingAmount)}</span>
                <Badge tone="gold">
                  {lot.expiresAt?.toLocaleDateString("pt-BR") ?? "—"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
