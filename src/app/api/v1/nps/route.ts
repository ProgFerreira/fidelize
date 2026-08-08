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
}
