import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey, logIntegration, enqueueWebhook } from "@/lib/integrations";
import { confirmAppointment } from "@/lib/reception";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  patientId: z.string(),
  walletId: z.string().optional(),
  procedureId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  grossAmount: z.number().positive(),
  discountAmount: z.number().min(0).optional(),
  benefitToUse: z.number().min(0).optional(),
  campaignId: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8),
  professionalName: z.string().optional(),
});

export async function POST(request: Request) {
  const started = Date.now();
  const key = request.headers.get("x-api-key") || "";
  const cred = await verifyApiKey(key);
  if (!cred) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (cred.rateLimited) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const idempotency = request.headers.get("idempotency-key");
  const json = await request.json();
  const parsed = bodySchema.safeParse({
    ...json,
    idempotencyKey: idempotency || json.idempotencyKey,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  let walletId = data.walletId;
  if (!walletId) {
    const wallet = await prisma.wallet.findFirst({
      where: { clinicId: cred.clinicId, patientId: data.patientId, status: "ACTIVE" },
    });
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }
    walletId = wallet.id;
  }

  const operator = await prisma.user.findFirst({
    where: { clinicId: cred.clinicId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!operator) {
    return NextResponse.json({ error: "No operator user" }, { status: 500 });
  }

  try {
    const result = await confirmAppointment({
      clinicId: cred.clinicId,
      patientId: data.patientId,
      walletId,
      procedureId: data.procedureId,
      unitId: data.unitId,
      operatorId: operator.id,
      grossAmount: data.grossAmount,
      discountAmount: data.discountAmount,
      benefitToUse: data.benefitToUse,
      campaignId: data.campaignId,
      idempotencyKey: data.idempotencyKey,
      professionalName: data.professionalName,
    });

    await enqueueWebhook({
      clinicId: cred.clinicId,
      eventType: "appointment.confirmed",
      payload: { appointmentId: result.appointment?.id },
      idempotencyKey: `api:appointment:${data.idempotencyKey}`,
    });

    await logIntegration({
      clinicId: cred.clinicId,
      direction: "IN",
      method: "POST",
      path: "/api/v1/appointments",
      statusCode: 200,
      durationMs: Date.now() - started,
      requestMeta: { idempotencyKey: data.idempotencyKey },
      responseMeta: { reused: result.reused },
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    await logIntegration({
      clinicId: cred.clinicId,
      direction: "IN",
      method: "POST",
      path: "/api/v1/appointments",
      statusCode: 400,
      durationMs: Date.now() - started,
      errorMessage: error instanceof Error ? error.message : "Erro",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro" },
      { status: 400 },
    );
  }
}
