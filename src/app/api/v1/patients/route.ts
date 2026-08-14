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
  });
}
