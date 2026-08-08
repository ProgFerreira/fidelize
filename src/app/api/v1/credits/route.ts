import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey, logIntegration } from "@/lib/integrations";
import { creditWallet } from "@/lib/ledger";

export async function POST(request: Request) {
  const started = Date.now();
  const key = request.headers.get("x-api-key") || "";
  const cred = await verifyApiKey(key);
  if (!cred) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (cred.rateLimited) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const patientId = String(body.patientId || "");
  const amount = Number(body.amount ?? 0);
  const points = Number(body.points ?? 0);
  const idempotencyKey =
    request.headers.get("Idempotency-Key") ||
    String(body.idempotencyKey || "");

  if (!patientId || (!amount && !points) || !idempotencyKey) {
    return NextResponse.json(
      { error: "patientId, amount/points e idempotencyKey são obrigatórios" },
      { status: 400 },
    );
  }

  const wallet = await prisma.wallet.findFirst({
    where: { clinicId: cred.clinicId, patientId, status: "ACTIVE" },
  });
  if (!wallet) {
    return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
  }

  const result = await creditWallet({
    clinicId: cred.clinicId,
    walletId: wallet.id,
    patientId,
    amount: amount || 0.0001,
    points,
    type: "CREDIT_ADJUSTMENT",
    origin: "api",
    reason: String(body.reason || "Crédito via API"),
    availableAt: new Date(),
    idempotencyKey,
  });

  await logIntegration({
    clinicId: cred.clinicId,
    direction: "IN",
    method: "POST",
    path: "/api/v1/credits",
    statusCode: 200,
    durationMs: Date.now() - started,
    requestMeta: { patientId, amount, points },
  });

  return NextResponse.json({ data: result });
}
