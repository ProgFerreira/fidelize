import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { dispatchProvider } from "@/lib/providers";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { onlyDigits } from "@/lib/patients";

/**
 * Webhook Meta WhatsApp Cloud API — consulta de saldo por mensagem "saldo".
 * Configure o callback em /api/webhooks/whatsapp
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];
  const from = message?.from as string | undefined;
  const text = String(message?.text?.body || "")
    .trim()
    .toLowerCase();

  if (!from || !text) {
    return NextResponse.json({ ok: true });
  }

  if (!/\bsaldo\b/.test(text) && text !== "extrato" && text !== "pontos") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const phoneDigits = onlyDigits(from);
  const phoneBr = phoneDigits.startsWith("55")
    ? phoneDigits.slice(2)
    : phoneDigits;

  const patient = await semOrganizacao(() =>
    prisma.patient.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ phone: phoneBr }, { phone: phoneDigits }],
      },
      include: {
        wallets: { include: { category: true }, take: 1 },
        clinic: { select: { id: true, organizationId: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  );

  if (!patient?.clinic.organizationId) {
    return NextResponse.json({ ok: true, matched: false });
  }

  await comOrganizacao(
    { organizationId: patient.clinic.organizationId },
    async () => {
      const wallet = patient.wallets[0];
      const reply = wallet
        ? `Olá, ${patient.fullName.split(" ")[0]}! Seu saldo em ${patient.clinic.name}: ${formatBRL(wallet.availableBalance)} e ${wallet.pointsBalance} pontos${wallet.category ? ` (${wallet.category.name})` : ""}.`
        : `Não encontramos carteira ativa para este telefone.`;

      await dispatchProvider({
        clinicId: patient.clinicId,
        channel: "WHATSAPP",
        to: phoneDigits,
        body: reply,
        subject: "Saldo fidelidade",
      });
    },
  );

  return NextResponse.json({ ok: true, matched: true });
}
