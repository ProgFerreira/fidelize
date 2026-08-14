import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logIntegration } from "@/lib/integrations";
import { comClinicaDaApi, credencialApiV1 } from "@/lib/api/v1-auth";

export async function GET(request: Request) {
  const started = Date.now();
  const auth = await credencialApiV1(request);
  if ("erro" in auth) return auth.erro;
  const { cred } = auth;

  return comClinicaDaApi(cred.clinicId, async () => {
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
  });
}
