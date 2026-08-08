import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import type { VoucherType, VoucherStatus } from "@/generated/prisma/client";

export const voucherSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum([
    "FIXED_VALUE",
    "PERCENT",
    "PROCEDURE",
    "GIFT",
    "COURTESY",
    "FEE",
    "RECOVERY",
    "BIRTHDAY",
  ]),
  valueAmount: z.coerce.number().optional().nullable(),
  valuePercent: z.coerce.number().optional().nullable(),
  quantity: z.coerce.number().int().optional().nullable(),
  maxUsesPerPatient: z.coerce.number().int().default(1),
  multiUse: z.boolean().default(false),
  minAmount: z.coerce.number().optional().nullable(),
  combineCashback: z.boolean().default(true),
  combineDiscount: z.boolean().default(false),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "CANCELLED"]).default("ACTIVE"),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  patientId: z.string().optional().nullable(),
});

function genCode() {
  return `VC${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createVoucher(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof voucherSchema>;
}) {
  await requireModule(input.clinicId, "VOUCHERS");
  const data = voucherSchema.parse(input.data);
  const voucher = await prisma.voucher.create({
    data: {
      clinicId: input.clinicId,
      code: genCode(),
      name: data.name,
      description: data.description ?? null,
      type: data.type as VoucherType,
      valueAmount: data.valueAmount != null ? String(data.valueAmount) : null,
      valuePercent: data.valuePercent != null ? String(data.valuePercent) : null,
      quantity: data.quantity ?? null,
      maxUsesPerPatient: data.maxUsesPerPatient,
      multiUse: data.multiUse,
      minAmount: data.minAmount != null ? String(data.minAmount) : null,
      combineCashback: data.combineCashback,
      combineDiscount: data.combineDiscount,
      status: data.status as VoucherStatus,
      startsAt: data.startsAt ?? null,
      expiresAt: data.expiresAt ?? null,
      patientId: data.patientId ?? null,
    },
  });
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "VOUCHER_ISSUE",
    entityType: "Voucher",
    entityId: voucher.id,
    afterData: { code: voucher.code, type: voucher.type },
  });
  return voucher;
}

export async function redeemVoucher(input: {
  clinicId: string;
  code: string;
  patientId: string;
  actorId?: string;
  amount?: number;
  unitId?: string | null;
}) {
  await requireModule(input.clinicId, "VOUCHERS");
  return prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findFirst({
      where: { clinicId: input.clinicId, code: input.code },
    });
    if (!voucher || voucher.status !== "ACTIVE") {
      throw new Error("Voucher inválido");
    }
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      throw new Error("Voucher expirado");
    }
    if (voucher.patientId && voucher.patientId !== input.patientId) {
      throw new Error("Voucher destinado a outro paciente");
    }
    if (voucher.quantity != null && voucher.usedCount >= voucher.quantity) {
      throw new Error("Voucher esgotado");
    }
    const patientUses = await tx.voucherRedemption.count({
      where: { voucherId: voucher.id, patientId: input.patientId },
    });
    if (!voucher.multiUse && patientUses >= voucher.maxUsesPerPatient) {
      throw new Error("Limite de uso atingido");
    }

    await tx.voucher.update({
      where: { id: voucher.id },
      data: { usedCount: { increment: 1 } },
    });

    const redemption = await tx.voucherRedemption.create({
      data: {
        clinicId: input.clinicId,
        voucherId: voucher.id,
        patientId: input.patientId,
        amount: input.amount != null ? String(input.amount) : voucher.valueAmount,
        unitId: input.unitId ?? null,
        actorId: input.actorId,
      },
    });

    return redemption;
  }).then(async (redemption) => {
    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "VOUCHER_REDEEM",
      entityType: "VoucherRedemption",
      entityId: redemption.id,
      afterData: { code: input.code, patientId: input.patientId },
    });
    return redemption;
  });
}

export async function listVouchers(clinicId: string) {
  return prisma.voucher.findMany({
    where: { clinicId },
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: "desc" },
  });
}
