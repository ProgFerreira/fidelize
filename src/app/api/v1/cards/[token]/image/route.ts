import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateLoyaltyCardSvg } from "@/lib/cards/image";

export const runtime = "nodejs";

/**
 * Imagem pública do cartão (SVG) via token do QR.
 * Útil para preview, download e link no WhatsApp.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const publicToken = decodeURIComponent(token || "").trim();
  if (!publicToken || publicToken.length < 16) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const card = await prisma.card.findFirst({
    where: { publicToken },
    include: {
      clinic: { select: { name: true, tradeName: true } },
      wallet: {
        include: {
          patient: { select: { fullName: true } },
          category: { select: { name: true } },
        },
      },
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
  }

  if (card.status === "BLOCKED" || card.status === "CANCELLED") {
    return NextResponse.json({ error: "Cartão indisponível" }, { status: 403 });
  }

  const svg = await generateLoyaltyCardSvg({
    clinicName: card.clinic.tradeName || card.clinic.name,
    patientName: card.wallet?.patient?.fullName ?? null,
    categoryName: card.wallet?.category?.name ?? null,
    cardNumber: card.cardNumber,
    publicToken: card.publicToken,
    kind: card.kind,
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="cartao-${card.cardNumber}.svg"`,
    },
  });
}
