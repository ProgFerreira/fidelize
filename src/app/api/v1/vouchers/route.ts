import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey, logIntegration } from "@/lib/integrations";

export async function GET(request: Request) {
  const started = Date.now();
  const key = request.headers.get("x-api-key") || "";
  const cred = await verifyApiKey(key);
  if (!cred) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (cred.rateLimited) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const patientId = new URL(request.url).searchParams.get("patientId");
  const vouchers = await prisma.voucher.findMany({
    where: {
      clinicId: cred.clinicId,
      status: "ACTIVE",
      ...(patientId
        ? { OR: [{ patientId }, { patientId: null }] }
        : {}),
    },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      valueAmount: true,
      valuePercent: true,
      expiresAt: true,
      status: true,
      patientId: true,
    },
  });

  await logIntegration({
    clinicId: cred.clinicId,
    direction: "IN",
    method: "GET",
    path: "/api/v1/vouchers",
    statusCode: 200,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({ data: vouchers });
}
