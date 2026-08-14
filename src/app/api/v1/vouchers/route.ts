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
  });
}
