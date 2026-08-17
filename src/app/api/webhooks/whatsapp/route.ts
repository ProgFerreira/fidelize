import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { dispatchProvider } from "@/lib/providers";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { onlyDigits } from "@/lib/patients";
import { hmacSha256Hex, secretsMatch } from "@/lib/security/secrets";
import {
  classifyWhatsAppReply,
  handleAppointmentReply,
} from "@/lib/whatsapp/reminders";

/**
 * Webhook Meta WhatsApp Cloud API — saldo, extrato e confirmação SIM/NÃO.
 * Configure o callback em /api/webhooks/whatsapp
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    mode === "subscribe" &&
    expected &&
    secretsMatch(token, expected)
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function webhookSecret() {
  return (
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.WHATSAPP_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

export async function POST(request: Request) {
  const secret = webhookSecret();
  if (secret.length < 8) {
    return NextResponse.json(
      { error: "Webhook não configurado" },
      { status: 503 },
    );
  }

  const raw = await request.text();
  const header = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${hmacSha256Hex(secret, raw)}`;
  if (!secretsMatch(header, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id?: string;
            from?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  } | null;
  try {
    body = JSON.parse(raw || "null") as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
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

  const intent = classifyWhatsAppReply(text);
  if (!intent) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // A Meta reentrega webhooks não confirmados (timeout, 5xx). Sem isso, um
  // reenvio duplicado reenvia a resposta ao paciente e duplica notas de
  // recusa de agendamento (handleAppointmentReply não é idempotente).
  const wamid = String(message?.id || "").trim();
  if (wamid) {
    const duplicado = await prisma.inboundWebhookEvent
      .create({ data: { provider: "whatsapp", externalId: wamid } })
      .then(() => false)
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === "P2002") return true;
        throw error;
      });
    if (duplicado) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const phoneDigits = onlyDigits(from);
  const phoneBr = phoneDigits.startsWith("55")
    ? phoneDigits.slice(2)
    : phoneDigits;

  // Hoje o WhatsApp é um único número compartilhado pela plataforma (sem
  // phone_number_id por clínica), então o telefone do paciente é o único
  // sinal que temos. Se o mesmo número existir em clínicas diferentes, não
  // dá pra saber pra qual delas a mensagem é — melhor não responder do que
  // vazar saldo/agenda da clínica errada.
  const candidatos = await semOrganizacao(() =>
    prisma.patient.findMany({
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

  if (candidatos.length === 0) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const clinicasDistintas = new Set(candidatos.map((p) => p.clinicId));
  if (clinicasDistintas.size > 1) {
    console.error("[webhook/whatsapp] telefone ambíguo entre clínicas", {
      clinicIds: [...clinicasDistintas],
    });
    return NextResponse.json({ ok: true, ambiguous: true });
  }

  const patient = candidatos[0];

  if (!patient?.clinic.organizationId) {
    return NextResponse.json({ ok: true, matched: false });
  }

  await comOrganizacao(
    { organizationId: patient.clinic.organizationId },
    async () => {
      let reply: string;
      if (intent === "SIM" || intent === "NAO") {
        const handled = await handleAppointmentReply({
          clinicId: patient.clinicId,
          patientId: patient.id,
          kind: intent,
        });
        reply = handled.body;
      } else {
        const wallet = patient.wallets[0];
        reply = wallet
          ? `Olá, ${patient.fullName.split(" ")[0]}! Seu saldo em ${patient.clinic.name}: ${formatBRL(wallet.availableBalance)} e ${wallet.pointsBalance} pontos${wallet.category ? ` (${wallet.category.name})` : ""}.`
          : `Não encontramos carteira ativa para este telefone.`;
      }

      await dispatchProvider({
        clinicId: patient.clinicId,
        channel: "WHATSAPP",
        to: phoneDigits,
        body: reply,
        subject: intent === "SALDO" ? "Saldo fidelidade" : "Agenda",
      });
    },
  );

  return NextResponse.json({ ok: true, matched: true, intent });
}
