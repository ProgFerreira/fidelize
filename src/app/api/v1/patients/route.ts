import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey, logIntegration } from "@/lib/integrations";

async function authClinic(request: Request) {
  const key = request.headers.get("x-api-key") || "";
  if (!key) return null;
  return verifyApiKey(key);
}

export async function GET(request: Request) {
  const started = Date.now();
  const cred = await authClinic(request);
  if (!cred) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ("rateLimited" in cred && cred.rateLimited) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const patients = await prisma.patient.findMany({
    where: {
      clinicId: cred.clinicId,
      OR: q
        ? [
            { fullName: { contains: q } },
            { phone: { contains: q } },
            { cpf: { contains: q } },
          ]
        : undefined,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
      registeredAt: true,
    },
    take: 50,
    orderBy: { fullName: "asc" },
  });

  await logIntegration({
    clinicId: cred.clinicId,
    direction: "IN",
    method: "GET",
    path: "/api/v1/patients",
    statusCode: 200,
    durationMs: Date.now() - started,
    requestMeta: { q },
    responseMeta: { count: patients.length },
  });

  return NextResponse.json({ data: patients });
}
