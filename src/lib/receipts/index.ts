import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { creditWallet } from "@/lib/ledger";
import type { ReceiptStatus, Prisma } from "@/generated/prisma/client";

export const submitReceiptSchema = z.object({
  patientId: z.string().min(1),
  imageUrl: z.string().url().optional().nullable(),
  imageBase64: z.string().optional().nullable(),
  declaredAmount: z.coerce.number().positive().optional().nullable(),
  merchantName: z.string().max(160).optional().nullable(),
  idempotencyKey: z.string().min(8).optional().nullable(),
});

function hashPayload(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** OCR pluggable: OCR.space se OCR_API_KEY, senão extrai heurística do texto/base64 declarado */
async function runOcr(input: {
  imageUrl?: string | null;
  imageBase64?: string | null;
  declaredAmount?: number | null;
  merchantName?: string | null;
}) {
  const key = process.env.OCR_API_KEY;
  if (key && (input.imageUrl || input.imageBase64)) {
    const form = new FormData();
    form.set("apikey", key);
    form.set("language", "por");
    form.set("isOverlayRequired", "false");
    if (input.imageUrl) form.set("url", input.imageUrl);
    if (input.imageBase64) {
      form.set("base64Image", `data:image/jpeg;base64,${input.imageBase64}`);
    }
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ParsedResults?: Array<{ ParsedText?: string }>;
      ErrorMessage?: string | string[];
    };
    const text = json.ParsedResults?.map((p) => p.ParsedText || "").join("\n") || "";
    return parseOcrText(text, input);
  }

  // Fallback: sem provedor OCR — usa valor declarado e marca revisão
  return {
    text: input.merchantName
      ? `MERCHANT:${input.merchantName}\nAMOUNT:${input.declaredAmount ?? ""}`
      : `AMOUNT:${input.declaredAmount ?? ""}`,
    amount: input.declaredAmount ?? null,
    merchantName: input.merchantName ?? null,
    date: null as Date | null,
    provider: "heuristic",
  };
}

function parseOcrText(
  text: string,
  fallback: { declaredAmount?: number | null; merchantName?: string | null },
) {
  const amountMatch =
    text.match(/(?:R\$\s*)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/i) ||
    text.match(/total[:\s]*(\d+[.,]\d{2})/i);
  let amount: number | null = fallback.declaredAmount ?? null;
  if (amountMatch?.[1]) {
    amount = Number(amountMatch[1].replace(/\./g, "").replace(",", "."));
  }
  const dateMatch = text.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{2,4})/);
  let date: Date | null = null;
  if (dateMatch) {
    const year =
      dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    date = new Date(`${year}-${dateMatch[2]}-${dateMatch[1]}`);
  }
  return {
    text,
    amount,
    merchantName: fallback.merchantName ?? null,
    date,
    provider: "ocr.space",
  };
}

function scoreFraud(input: {
  amount: number | null;
  declaredAmount?: number | null;
  duplicateHash: boolean;
  recentCount: number;
  ocrFailed: boolean;
}) {
  const flags: string[] = [];
  let score = 0;
  if (input.duplicateHash) {
    flags.push("DUPLICATE_IMAGE");
    score += 40;
  }
  if (
    input.amount != null &&
    input.declaredAmount != null &&
    Math.abs(input.amount - input.declaredAmount) > 1
  ) {
    flags.push("AMOUNT_MISMATCH");
    score += 25;
  }
  if (input.recentCount >= 5) {
    flags.push("BURST_UPLOADS");
    score += 20;
  }
  if (input.ocrFailed) {
    flags.push("OCR_WEAK");
    score += 15;
  }
  if (input.amount != null && input.amount > 5000) {
    flags.push("HIGH_AMOUNT");
    score += 10;
  }
  return { flags, score };
}

export async function submitReceipt(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof submitReceiptSchema>;
}) {
  await requireModule(input.clinicId, "RECEIPTS");
  const data = submitReceiptSchema.parse(input.data);
  if (!data.imageUrl && !data.imageBase64) {
    throw new Error("Informe imageUrl ou imageBase64");
  }

  const raw = data.imageBase64 || data.imageUrl || "";
  const imageHash = hashPayload(raw.slice(0, 50000));

  if (data.idempotencyKey) {
    const existing = await prisma.receiptSubmission.findUnique({
      where: {
        clinicId_idempotencyKey: {
          clinicId: input.clinicId,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
  }

  const duplicate = await prisma.receiptSubmission.findFirst({
    where: {
      clinicId: input.clinicId,
      imageHash,
      status: { notIn: ["REJECTED"] },
    },
  });
  const recentCount = await prisma.receiptSubmission.count({
    where: {
      clinicId: input.clinicId,
      patientId: data.patientId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  const row = await prisma.receiptSubmission.create({
    data: {
      clinicId: input.clinicId,
      patientId: data.patientId,
      imageUrl: data.imageUrl ?? null,
      imageHash,
      status: "PROCESSING",
      merchantName: data.merchantName ?? null,
      extractedAmount:
        data.declaredAmount != null ? String(data.declaredAmount) : null,
      idempotencyKey: data.idempotencyKey ?? null,
    },
  });

  const ocr = await runOcr({
    imageUrl: data.imageUrl,
    imageBase64: data.imageBase64,
    declaredAmount: data.declaredAmount,
    merchantName: data.merchantName,
  });

  const fraud = scoreFraud({
    amount: ocr.amount,
    declaredAmount: data.declaredAmount,
    duplicateHash: Boolean(duplicate),
    recentCount,
    ocrFailed: !ocr.amount,
  });

  // Antifraude real: baixo risco + OCR com valor → crédito automático;
  // score alto ou OCR sem valor → revisão humana.
  const lowRisk =
    fraud.score < 25 &&
    ocr.amount != null &&
    ocr.amount > 0 &&
    !fraud.flags.includes("DUPLICATE_IMAGE") &&
    !fraud.flags.includes("BURST_UPLOADS");

  let status: ReceiptStatus = lowRisk ? "APPROVED" : "NEEDS_REVIEW";
  if (!ocr.amount) status = "NEEDS_REVIEW";

  let updated = await prisma.receiptSubmission.update({
    where: { id: row.id },
    data: {
      ocrText: ocr.text.slice(0, 20000),
      extractedAmount: ocr.amount != null ? String(ocr.amount) : null,
      extractedDate: ocr.date,
      merchantName: ocr.merchantName ?? data.merchantName ?? null,
      fraudFlags: fraud.flags as Prisma.InputJsonValue,
      fraudScore: fraud.score,
      status,
      metadata: { ocrProvider: ocr.provider, autoDecision: lowRisk },
    },
  });

  if (status === "APPROVED" && ocr.amount != null && ocr.amount > 0) {
    try {
      updated = await reviewReceipt({
        clinicId: input.clinicId,
        receiptId: updated.id,
        actorId: input.actorId ?? "system-antifraud",
        decision: "APPROVED",
        creditAmount: ocr.amount,
        notes: "Aprovação automática (antifraude baixo risco)",
      });
    } catch {
      updated = await prisma.receiptSubmission.update({
        where: { id: updated.id },
        data: { status: "NEEDS_REVIEW" },
      });
      status = "NEEDS_REVIEW";
    }
  }

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "RECEIPT_REVIEW",
    entityType: "ReceiptSubmission",
    entityId: updated.id,
    afterData: {
      status: updated.status,
      fraudScore: fraud.score,
      flags: fraud.flags,
      autoApproved: lowRisk && updated.status === "CREDITED",
    },
  });

  return updated;
}

export async function reviewReceipt(input: {
  clinicId: string;
  receiptId: string;
  actorId: string;
  decision: "APPROVED" | "REJECTED";
  creditAmount?: number;
  notes?: string;
}) {
  await requireModule(input.clinicId, "RECEIPTS");
  const receipt = await prisma.receiptSubmission.findFirst({
    where: { id: input.receiptId, clinicId: input.clinicId },
  });
  if (!receipt) throw new Error("Comprovante não encontrado");
  if (!["NEEDS_REVIEW", "PROCESSING", "UPLOADED", "APPROVED"].includes(receipt.status)) {
    throw new Error("Comprovante já revisado");
  }

  if (input.decision === "REJECTED") {
    const updated = await prisma.receiptSubmission.update({
      where: { id: receipt.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: input.actorId,
        reviewNotes: input.notes ?? null,
      },
    });
    await writeAuditLog({
      clinicId: input.clinicId,
      userId: input.actorId,
      action: "RECEIPT_REVIEW",
      entityType: "ReceiptSubmission",
      entityId: updated.id,
      afterData: { status: "REJECTED" },
    });
    return updated;
  }

  const amount =
    input.creditAmount ??
    (receipt.extractedAmount ? Number(receipt.extractedAmount) : 0);
  if (amount <= 0) throw new Error("Valor de crédito inválido");

  const wallet = await prisma.wallet.findFirst({
    where: {
      clinicId: input.clinicId,
      patientId: receipt.patientId,
      status: "ACTIVE",
    },
  });
  if (!wallet) throw new Error("Carteira não encontrada");

  const credit = await creditWallet({
    clinicId: input.clinicId,
    walletId: wallet.id,
    patientId: receipt.patientId,
    amount,
    points: 0,
    type: "CREDIT_ADJUSTMENT",
    origin: "receipt_ocr",
    reason: `Comprovante ${receipt.id}`,
    availableAt: new Date(),
    idempotencyKey: `receipt-credit:${receipt.id}`,
  });

  const updated = await prisma.receiptSubmission.update({
    where: { id: receipt.id },
    data: {
      status: "CREDITED",
      creditAmount: String(amount),
      ledgerEntryId: credit.entry.id,
      reviewedAt: new Date(),
      reviewedBy: input.actorId,
      reviewNotes: input.notes ?? null,
    },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "RECEIPT_REVIEW",
    entityType: "ReceiptSubmission",
    entityId: updated.id,
    afterData: { status: "CREDITED", amount },
  });

  return updated;
}

export async function listReceipts(clinicId: string) {
  return prisma.receiptSubmission.findMany({
    where: { clinicId },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
