import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey, logIntegration } from "@/lib/integrations";

export async function GET(request: Request) {
  const started = Date.now();
  const key = request.headers.get("x-api-key") || "";
  const cred = await verifyApiKey(key);
  if (!cred) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (cred.rateLimited) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }

  const wallet = await prisma.wallet.findFirst({
    where: { clinicId: cred.clinicId, patientId },
    include: { category: { select: { name: true, slug: true } } },
  });

  await logIntegration({
    clinicId: cred.clinicId,
    direction: "IN",
    method: "GET",
    path: "/api/v1/balance",
    statusCode: wallet ? 200 : 404,
    durationMs: Date.now() - started,
    requestMeta: { patientId },
  });

  if (!wallet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      pointsBalance: wallet.pointsBalance,
      category: wallet.category,
    },
  });
}
