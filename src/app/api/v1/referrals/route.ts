import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey, logIntegration } from "@/lib/integrations";

async function auth(request: Request) {
  const key = request.headers.get("x-api-key") || "";
  if (!key) return null;
  return verifyApiKey(key);
}

export async function GET(request: Request) {
  const started = Date.now();
  const cred = await auth(request);
  if (!cred) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (cred.rateLimited) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const patientId = new URL(request.url).searchParams.get("patientId");
  const referrals = await prisma.referral.findMany({
    where: {
      clinicId: cred.clinicId,
      ...(patientId
        ? { OR: [{ referrerId: patientId }, { referredId: patientId }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      shortCode: true,
      leadName: true,
      leadPhone: true,
      referrerId: true,
      referredId: true,
      convertedAt: true,
      createdAt: true,
    },
  });

  await logIntegration({
    clinicId: cred.clinicId,
    direction: "IN",
    method: "GET",
    path: "/api/v1/referrals",
    statusCode: 200,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({ data: referrals });
}
