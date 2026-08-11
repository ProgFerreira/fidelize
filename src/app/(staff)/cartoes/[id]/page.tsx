import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { generateCardQrDataUrl, getCardHistory } from "@/lib/cards";
import { loyaltyCardWhatsAppText } from "@/lib/cards/image";
import { Badge, Button, PageHeader } from "@/components/ui";
import { labelPt } from "@/lib/i18n/labels";
import { CardWhatsAppShare } from "@/components/cards/card-whatsapp-share";

export default async function CartaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CARDS_MANAGE);
  const { id } = await params;

  const card = await prisma.card.findFirst({
    where: { id, clinicId: session.clinicId },
    include: {
      unit: true,
      clinic: { select: { name: true, tradeName: true } },
      wallet: {
        include: {
          patient: true,
          category: { select: { name: true } },
        },
      },
    },
  });
  if (!card) notFound();

  const [history, qr, replacement] = await Promise.all([
    getCardHistory(session.clinicId, card.id),
    generateCardQrDataUrl(card.publicToken),
    card.replacedById
      ? prisma.card.findFirst({
          where: { id: card.replacedById, clinicId: session.clinicId },
          select: { id: true, cardNumber: true },
        })
      : null,
  ]);

  const clinicName = card.clinic.tradeName || card.clinic.name;
  const imageUrl = `/api/v1/cards/${encodeURIComponent(card.publicToken)}/image`;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "";
  const absoluteImageUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}${imageUrl}`
    : imageUrl;
  const patientName = card.wallet?.patient?.fullName ?? null;
  const phone = card.wallet?.patient?.phone ?? null;
  const waText = loyaltyCardWhatsAppText({
    clinicName,
    patientName,
    cardNumber: card.cardNumber,
    imageUrl: absoluteImageUrl,
  });

  return (
    <div className="cartoes-page">
      <PageHeader
        title={card.cardNumber}
        description="Detalhe, arte para WhatsApp, QR e histórico auditado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/cartoes">
              <Button variant="contorno">Voltar</Button>
            </Link>
            {card.status === "AVAILABLE" || card.status === "ACTIVE" ? (
              <Link href={`/cartoes/imprimir?ids=${card.id}`}>
                <Button variant="gold">Imprimir QR</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="cartao-detail cartao-detail--wa">
        <section className="cartoes-panel">
          <h2 className="cartoes-panel__title">Arte para WhatsApp</h2>
          <p className="cartoes-panel__desc">
            Gere a imagem do cartão e envie ao paciente pelo WhatsApp.
          </p>
          <div className="mt-4">
            <CardWhatsAppShare
              cardNumber={card.cardNumber}
              imageUrl={imageUrl}
              clinicName={clinicName}
              patientName={patientName}
              phone={phone}
              whatsappText={waText}
            />
          </div>
        </section>

        <section className="cartoes-panel">
          <div className="cartao-detail__qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR ${card.cardNumber}`} />
            <div>
              <div className="cartao-row__title-line">
                <Badge
                  tone={
                    card.status === "ACTIVE"
                      ? "success"
                      : card.status === "BLOCKED"
                        ? "danger"
                        : card.status === "AVAILABLE"
                          ? "gold"
                          : "muted"
                  }
                >
                  {labelPt(card.status)}
                </Badge>
                <Badge tone={card.kind === "VIRTUAL" ? "azul" : "muted"}>
                  {card.kind === "VIRTUAL" ? "Virtual" : "Físico"}
                </Badge>
              </div>
              <p className="cartao-detail__token">{card.publicToken}</p>
              <dl className="cartao-detail__meta">
                <div>
                  <dt>Unidade</dt>
                  <dd>{card.unit?.name ?? "Estoque geral"}</dd>
                </div>
                <div>
                  <dt>Paciente</dt>
                  <dd>
                    {card.wallet?.patient ? (
                      <Link href={`/pacientes/${card.wallet.patient.id}`}>
                        {card.wallet.patient.fullName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Categoria</dt>
                  <dd>{card.wallet?.category?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Criado</dt>
                  <dd>{card.createdAt.toLocaleString("pt-BR")}</dd>
                </div>
                <div>
                  <dt>Vinculado</dt>
                  <dd>
                    {card.linkedAt
                      ? card.linkedAt.toLocaleString("pt-BR")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>
                    {card.expiresAt
                      ? card.expiresAt.toLocaleDateString("pt-BR")
                      : "Sem validade"}
                  </dd>
                </div>
                <div>
                  <dt>Substituído por</dt>
                  <dd>
                    {replacement ? (
                      <Link href={`/cartoes/${replacement.id}`}>
                        {replacement.cardNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                {card.blockedReason ? (
                  <div>
                    <dt>Motivo</dt>
                    <dd>{card.blockedReason}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </section>

        <section className="cartoes-panel cartao-detail__history">
          <h2 className="cartoes-panel__title">Histórico</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nenhuma movimentação auditada ainda.
            </p>
          ) : (
            <ul className="cartao-history">
              {history.map((log) => (
                <li key={log.id}>
                  <div>
                    <p className="cartao-history__action">
                      {labelPt(log.action)}
                    </p>
                    <p className="cartao-history__meta">
                      {log.user?.name ?? "Sistema"} ·{" "}
                      {log.createdAt.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {log.afterData ? (
                    <pre className="cartao-history__data">
                      {JSON.stringify(log.afterData, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
