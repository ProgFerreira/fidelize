import { NextResponse } from "next/server";
import { verifyApiKey, logIntegration } from "@/lib/integrations";
import {
  CLINICAL_CONNECTORS,
  clinicalConnectorDocs,
  ingestClinicalAppointment,
  parseClinicalAppointmentPayload,
} from "@/lib/connectors/clinical";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { prisma } from "@/lib/db";

async function authClinic(request: Request) {
  const key = request.headers.get("x-api-key") || "";
  if (!key) return null;
  return semOrganizacao(() => verifyApiKey(key));
}

export async function GET(request: Request) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  const cred = await authClinic(request);
  if (!cred) {
    // Docs públicas resumidas
    return NextResponse.json({
      data: {
        connectors: CLINICAL_CONNECTORS,
        authRequired: true,
        docs: clinicalConnectorDocs(baseUrl),
      },
    });
  }
  return NextResponse.json({
    data: clinicalConnectorDocs(baseUrl),
  });
}

export async function POST(request: Request) {
  const started = Date.now();
  const cred = await authClinic(request);
  if (!cred || cred.rateLimited) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clinic = await semOrganizacao(() =>
    prisma.clinic.findUnique({
      where: { id: cred.clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) {
    return NextResponse.json({ error: "Clínica inválida" }, { status: 400 });
  }
  const organizationId = clinic.organizationId;

  try {
    const body = await request.json();
    const payload = parseClinicalAppointmentPayload(body);

    // operator: primeiro admin/manager da clínica
    const operator = await semOrganizacao(() =>
      prisma.user.findFirst({
        where: {
          clinicId: cred.clinicId,
          status: "ACTIVE",
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
    );
    if (!operator) {
      return NextResponse.json(
        { error: "Nenhum operador ativo na clínica" },
        { status: 400 },
      );
    }

    const result = await comOrganizacao(
      { organizationId },
      () =>
        ingestClinicalAppointment({
          clinicId: cred.clinicId,
          operatorId: operator.id,
          organizationId,
          payload,
        }),
    );

    await comOrganizacao({ organizationId }, () =>
      logIntegration({
        clinicId: cred.clinicId,
        direction: "IN",
        method: "POST",
        path: "/api/v1/connectors/clinical/appointments",
        statusCode: 200,
        durationMs: Date.now() - started,
      }),
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Falha na ingestão clínica",
      },
      { status: 400 },
    );
  }
}
