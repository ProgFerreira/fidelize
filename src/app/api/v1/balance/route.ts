import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logIntegration } from "@/lib/integrations";
import { comClinicaDaApi, credencialApiV1 } from "@/lib/api/v1-auth";

export async function GET(request: Request) {
  const started = Date.now();
  const auth = await credencialApiV1(request);
  if ("erro" in auth) return auth.erro;
  const { cred } = auth;

  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }

  return comClinicaDaApi(cred.clinicId, async () => {
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
  });
}
