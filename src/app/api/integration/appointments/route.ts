import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { confirmAppointment } from "@/lib/reception";
import { onlyDigits } from "@/lib/patients";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { createHash } from "node:crypto";
import { z } from "zod";

const schema = z.object({
  cpf: z.string().optional(),
  externalCode: z.string().optional(),
  procedureCode: z.string().optional(),
  grossAmount: z.number().positive(),
  discountAmount: z.number().min(0).optional(),
  benefitToUse: z.number().min(0).optional(),
  paidConfirmed: z.boolean().default(true),
  professionalName: z.string().optional(),
  unitCode: z.string().optional(),
  occurredAt: z.string().optional(),
  idempotencyKey: z.string().min(8),
  cancel: z.boolean().optional(),
  refund: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const apiKey = request.headers.get("x-api-key");

  let organizationId = session?.user?.organizationId ?? null;
  let clinicId = session?.user?.clinicId ?? null;

  if (!session?.user) {
    if (!apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const cred = await semOrganizacao(() =>
      prisma.apiCredential.findFirst({
        where: {
          keyHash,
          revokedAt: null,
        },
        select: { organizationId: true, clinicId: true },
      }),
    );
    if (!cred?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    organizationId = cred.organizationId;
    clinicId = cred.clinicId;
  }

  if (!organizationId) {
    return NextResponse.json({ error: "Organização não definida" }, { status: 401 });
  }

  const body = schema.parse(await request.json());

  return comOrganizacao({ organizationId }, async () => {
    if (!clinicId) {
      clinicId =
        (
          await prisma.clinic.findFirst({
            where: { active: true },
            orderBy: { createdAt: "asc" },
          })
        )?.id ?? null;
    }

    if (!clinicId) {
      return NextResponse.json({ error: "Clínica não encontrada" }, { status: 404 });
    }

    const patient = await prisma.patient.findFirst({
      where: {
        clinicId,
        OR: [
          body.cpf ? { cpf: onlyDigits(body.cpf) } : undefined,
          body.externalCode ? { externalCode: body.externalCode } : undefined,
        ].filter(Boolean) as object[],
      },
      include: {
        wallets: { where: { status: "ACTIVE" }, include: { category: true } },
      },
    });

    if (!patient || !patient.wallets[0]) {
      return NextResponse.json(
        { error: "Paciente não encontrado" },
        { status: 404 },
      );
    }

    const procedure = body.procedureCode
      ? await prisma.procedure.findFirst({
          where: { clinicId, code: body.procedureCode },
        })
      : null;

    const unit = body.unitCode
      ? await prisma.unit.findFirst({ where: { clinicId, code: body.unitCode } })
      : null;

    if (!body.paidConfirmed) {
      return NextResponse.json({
        status: "awaiting_payment",
        patientId: patient.id,
        balance: patient.wallets[0].availableBalance,
        category: patient.wallets[0].category?.name,
      });
    }

    const operatorId =
      session?.user.id ??
      (
        await prisma.user.findFirst({
          where: { clinicId, status: "ACTIVE" },
          include: { role: true },
        })
      )?.id;

    if (!operatorId) {
      return NextResponse.json(
        { error: "Operador não disponível" },
        { status: 400 },
      );
    }

    const result = await confirmAppointment({
      clinicId,
      unitId: unit?.id,
      patientId: patient.id,
      walletId: patient.wallets[0].id,
      procedureId: procedure?.id,
      operatorId,
      professionalName: body.professionalName,
      grossAmount: body.grossAmount,
      discountAmount: body.discountAmount,
      benefitToUse: body.benefitToUse,
      idempotencyKey: body.idempotencyKey,
    });

    const wallet = await prisma.wallet.findUnique({
      where: { id: patient.wallets[0].id },
      include: { category: true },
    });

    return NextResponse.json({
      transactionCode: result.appointment?.id,
      status: result.appointment?.status,
      balance: wallet?.availableBalance,
      category: wallet?.category?.name,
      benefitUsed: result.appointment?.benefitUsed,
      cashbackGenerated: result.appointment?.cashbackGenerated,
      pointsGenerated: result.appointment?.pointsGenerated,
      reused: result.reused,
    });
  });
}
