import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { generateCardQrDataUrl, listCardsForPrint } from "@/lib/cards";
import { Button, PageHeader } from "@/components/ui";
import { PrintButtons } from "@/components/cards/print-buttons";

export default async function CartoesImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{
    ids?: string;
    status?: string;
    unidade?: string;
  }>;
}) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const { ids, status, unidade } = await searchParams;
  const idList = ids
    ? ids.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const cards = await listCardsForPrint({
    clinicId: session.clinicId,
    ids: idList,
    status: status === "ACTIVE" ? "ACTIVE" : "AVAILABLE",
    unitId: unidade || null,
    take: 120,
  });

  const withQr = await Promise.all(
    cards.map(async (card) => ({
      id: card.id,
      cardNumber: card.cardNumber,
      unitName: card.unit?.name ?? "Estoque geral",
      patientName: card.wallet?.patient?.fullName ?? null,
      qr: await generateCardQrDataUrl(card.publicToken),
    })),
  );

  return (
    <div className="cartoes-print-page">
      <div className="cartoes-print-toolbar no-print">
        <PageHeader
          title="Impressão de QR"
          description={`${withQr.length} etiqueta(s) · use papel A4 ou folha de etiquetas.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/cartoes">
                <Button variant="contorno">Voltar</Button>
              </Link>
              <PrintButtons />
            </div>
          }
        />
      </div>

      {withQr.length === 0 ? (
        <p className="no-print text-sm text-slate-500">
          Nenhum cartão para imprimir com os filtros atuais.
        </p>
      ) : (
        <div className="cartoes-print-sheet">
          {withQr.map((card) => (
            <div key={card.id} className="cartoes-print-label">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.qr} alt={`QR ${card.cardNumber}`} />
              <p className="cartoes-print-label__number">{card.cardNumber}</p>
              <p className="cartoes-print-label__meta">{card.unitName}</p>
              {card.patientName ? (
                <p className="cartoes-print-label__meta">{card.patientName}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
