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
    const responses = await prisma.surveyResponse.findMany({
      where: {
        clinicId: cred.clinicId,
        ...(patientId ? { patientId } : {}),
        respondedAt: { not: null },
      },
      take: 50,
      orderBy: { respondedAt: "desc" },
      select: {
        id: true,
        patientId: true,
        appointmentId: true,
        score: true,
        classification: true,
        comment: true,
        respondedAt: true,
      },
    });

    await logIntegration({
      clinicId: cred.clinicId,
      direction: "IN",
      method: "GET",
      path: "/api/v1/nps",
      statusCode: 200,
      durationMs: Date.now() - started,
    });

    return NextResponse.json({ data: responses });
  });
}
