import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { creditWallet } from "@/lib/ledger";
import { assignTag } from "@/lib/tags";
import { runAutomationsForTrigger } from "@/lib/automations";
import { onlyDigits } from "@/lib/patients/cpf";
import type { ReferralStatus } from "@/generated/prisma/client";

export const referralProgramSchema = z.object({
  name: z.string().min(2).max(120),
  referrerCashback: z.coerce.number().min(0).default(0),
  referrerPoints: z.coerce.number().int().min(0).default(0),
  referredCashback: z.coerce.number().min(0).default(0),
  referredPoints: z.coerce.number().int().min(0).default(0),
  minFirstAppointment: z.coerce.number().min(0).default(0),
  conversionDays: z.coerce.number().int().min(1).default(90),
  maxReferralsPerPeriod: z.coerce.number().int().optional().nullable(),
  periodDays: z.coerce.number().int().default(30),
  benefitValidityDays: z.coerce.number().int().default(90),
});

function shortCode() {
  return randomBytes(4).toString("hex").slice(0, 8);
}

function provisionalCpf(phone: string) {
  const hash = createHash("sha256").update(`ref-lead:${phone}`).digest("hex");
  const digits = hash.replace(/\D/g, "").slice(0, 11).padEnd(11, "0");
  return `9${digits.slice(1)}`;
}

export async function upsertReferralProgram(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof referralProgramSchema>;
}) {
  await requireModule(input.clinicId, "REFERRAL");
  const data = referralProgramSchema.parse(input.data);
  const existing = await prisma.referralProgram.findFirst({
    where: { clinicId: input.clinicId, active: true },
  });
  if (existing) {
    return prisma.referralProgram.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        referrerCashback: String(data.referrerCashback),
        referrerPoints: data.referrerPoints,
        referredCashback: String(data.referredCashback),
        referredPoints: data.referredPoints,
        minFirstAppointment: String(data.minFirstAppointment),
        conversionDays: data.conversionDays,
        maxReferralsPerPeriod: data.maxReferralsPerPeriod ?? null,
        periodDays: data.periodDays,
        benefitValidityDays: data.benefitValidityDays,
      },
    });
  }
  return prisma.referralProgram.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      referrerCashback: String(data.referrerCashback),
      referrerPoints: data.referrerPoints,
      referredCashback: String(data.referredCashback),
      referredPoints: data.referredPoints,
      minFirstAppointment: String(data.minFirstAppointment),
      conversionDays: data.conversionDays,
      maxReferralsPerPeriod: data.maxReferralsPerPeriod ?? null,
      periodDays: data.periodDays,
      benefitValidityDays: data.benefitValidityDays,
    },
  });
}

export async function ensureReferralLink(input: {
  clinicId: string;
  patientId: string;
}) {
  await requireModule(input.clinicId, "REFERRAL");
  let program = await prisma.referralProgram.findFirst({
    where: { clinicId: input.clinicId, active: true },
  });
  if (!program) {
    program = await upsertReferralProgram({
      clinicId: input.clinicId,
      data: {
        name: "Indique e ganhe",
        referrerCashback: 50,
        referrerPoints: 100,
        referredCashback: 30,
        referredPoints: 50,
        minFirstAppointment: 100,
        conversionDays: 90,
        periodDays: 30,
        benefitValidityDays: 90,
      },
    });
  }

  const existing = await prisma.referral.findFirst({
    where: {
      clinicId: input.clinicId,
      referrerId: input.patientId,
      referredId: null,
      status: { in: ["LEAD", "LINK_OPENED"] },
      leadPhone: null,
    },
  });
  if (existing) return { program, referral: existing };

  const code = `ref_${randomBytes(8).toString("hex")}`;
  const referral = await prisma.referral.create({
    data: {
      clinicId: input.clinicId,
      programId: program.id,
      referrerId: input.patientId,
      code,
      shortCode: shortCode(),
      status: "LINK_OPENED",
      expiresAt: new Date(
        Date.now() + program.conversionDays * 24 * 60 * 60 * 1000,
      ),
    },
  });
  return { program, referral };
}

export function referralShareUrl(shortCode: string, origin?: string) {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/i/${shortCode}`;
}

export function referralQrUrl(shortCode: string, origin?: string) {
  const url = encodeURIComponent(referralShareUrl(shortCode, origin));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${url}`;
}

export async function registerReferralLead(input: {
  clinicId: string;
  shortCode: string;
  leadName: string;
  leadPhone: string;
  leadConsent: boolean;
  leadCpf?: string | null;
}) {
  const referral = await prisma.referral.findFirst({
    where: { clinicId: input.clinicId, shortCode: input.shortCode },
    include: { program: true, referrer: true },
  });
  if (!referral) throw new Error("Link de indicação inválido");
  if (!input.leadConsent) throw new Error("Consentimento obrigatório");
  if (referral.expiresAt && referral.expiresAt < new Date()) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Link de indicação expirado");
  }
  if (referral.referredId || referral.leadPhone) {
    throw new Error("Este link já foi utilizado");
  }

  const phone = onlyDigits(input.leadPhone);
  const fraudFlags: string[] = [];

  if (referral.referrer.phone === phone) {
    fraudFlags.push("AUTO_REFERRAL_PHONE");
  }

  const phoneDup = await prisma.patient.findFirst({
    where: { clinicId: input.clinicId, phone },
  });
  if (phoneDup) {
    if (phoneDup.id === referral.referrerId) fraudFlags.push("AUTO_REFERRAL");
    else fraudFlags.push("PHONE_EXISTS");
  }

  if (input.leadCpf) {
    const cpf = onlyDigits(input.leadCpf);
    const cpfDup = await prisma.patient.findFirst({
      where: { clinicId: input.clinicId, cpf },
    });
    if (cpfDup) {
      if (cpfDup.id === referral.referrerId) fraudFlags.push("AUTO_REFERRAL_CPF");
      else fraudFlags.push("CPF_EXISTS");
    }
  }

  const recentWindow = new Date(
    Date.now() - referral.program.periodDays * 24 * 60 * 60 * 1000,
  );
  const recentCount = await prisma.referral.count({
    where: {
      clinicId: input.clinicId,
      referrerId: referral.referrerId,
      createdAt: { gte: recentWindow },
      status: { notIn: ["REJECTED", "EXPIRED"] },
      leadPhone: { not: null },
    },
  });
  if (
    referral.program.maxReferralsPerPeriod != null &&
    recentCount >= referral.program.maxReferralsPerPeriod
  ) {
    fraudFlags.push("RATE_LIMIT");
  }

  const burst = await prisma.referral.count({
    where: {
      clinicId: input.clinicId,
      referrerId: referral.referrerId,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      leadPhone: { not: null },
    },
  });
  if (burst >= 10) fraudFlags.push("BURST");

  let referredId: string | null = phoneDup?.id ?? null;

  if (!referredId && !fraudFlags.includes("AUTO_REFERRAL") && !fraudFlags.includes("AUTO_REFERRAL_PHONE")) {
    const bronze = await prisma.category.findFirst({
      where: { clinicId: input.clinicId, slug: "bronze", active: true },
    });
    const cpf = input.leadCpf
      ? onlyDigits(input.leadCpf)
      : provisionalCpf(phone);

    const existingCpf = await prisma.patient.findFirst({
      where: { clinicId: input.clinicId, cpf },
    });
    if (existingCpf) {
      referredId = existingCpf.id;
      if (existingCpf.id === referral.referrerId) fraudFlags.push("AUTO_REFERRAL");
    } else {
      const created = await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({
          data: {
            clinicId: input.clinicId,
            fullName: input.leadName.trim(),
            cpf,
            phone,
            regulationConsent: true,
            marketingConsent: true,
            commercialNotes: `Lead de indicação (${referral.shortCode})`,
            status: "ACTIVE",
          },
        });
        await tx.wallet.create({
          data: {
            clinicId: input.clinicId,
            patientId: patient.id,
            categoryId: bronze?.id,
            status: "ACTIVE",
          },
        });
        return patient;
      });
      referredId = created.id;
    }
  }

  if (referredId === referral.referrerId) {
    fraudFlags.push("AUTO_REFERRAL");
    referredId = null;
  }

  const alreadyConverted = referredId
    ? await prisma.referral.findFirst({
        where: {
          clinicId: input.clinicId,
          referredId,
          status: { in: ["CONVERTED", "BENEFIT_GRANTED", "BENEFIT_PENDING"] },
        },
      })
    : null;
  if (alreadyConverted) fraudFlags.push("DUPLICATE_CONVERSION");

  const status: ReferralStatus = fraudFlags.length
    ? "SUSPICIOUS"
    : referredId
      ? "LEAD"
      : "LEAD";

  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: {
      leadName: input.leadName.trim(),
      leadPhone: phone,
      leadConsent: true,
      referredId: fraudFlags.includes("DUPLICATE_CONVERSION") ? null : referredId,
      status: fraudFlags.includes("DUPLICATE_CONVERSION") ? "REJECTED" : status,
      fraudFlags: fraudFlags.length ? fraudFlags : undefined,
      openedAt: referral.openedAt ?? new Date(),
    },
  });

  // Cria novo link vazio para o indicador continuar indicando
  await ensureReferralLink({
    clinicId: input.clinicId,
    patientId: referral.referrerId,
  }).catch(() => undefined);

  await runAutomationsForTrigger({
    clinicId: input.clinicId,
    trigger: "REFERRAL_CREATED",
    patientId: referral.referrerId,
    triggerRef: updated.id,
  }).catch(() => undefined);

  await writeAuditLog({
    clinicId: input.clinicId,
    action: "REFERRAL_CREATE",
    entityType: "Referral",
    entityId: updated.id,
    afterData: { status: updated.status, fraudFlags, referredId },
  });

  return updated;
}

/** Liga lead aberto ao paciente recém-cadastrado (mesmo telefone). */
export async function linkReferralLeadToPatient(input: {
  clinicId: string;
  patientId: string;
  phone: string;
}) {
  const phone = onlyDigits(input.phone);
  const leads = await prisma.referral.findMany({
    where: {
      clinicId: input.clinicId,
      leadPhone: phone,
      referredId: null,
      status: { in: ["LEAD", "LINK_OPENED", "SUSPICIOUS"] },
    },
  });

  for (const lead of leads) {
    if (lead.referrerId === input.patientId) {
      await prisma.referral.update({
        where: { id: lead.id },
        data: { status: "REJECTED", fraudFlags: ["AUTO_REFERRAL_LATE"] },
      });
      continue;
    }
    await prisma.referral.update({
      where: { id: lead.id },
      data: {
        referredId: input.patientId,
        status: "LEAD",
      },
    });
  }
  return leads.length;
}

export async function convertReferralOnAppointment(input: {
  clinicId: string;
  patientId: string;
  appointmentId: string;
  paidAmount: number;
}) {
  if (
    !(await prisma.featureModule.findFirst({
      where: { clinicId: input.clinicId, code: "REFERRAL", enabled: true },
    }))
  ) {
    return null;
  }

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId: input.clinicId },
  });
  if (!patient) return null;

  let referral = await prisma.referral.findFirst({
    where: {
      clinicId: input.clinicId,
      referredId: input.patientId,
      status: { in: ["LEAD", "APPOINTMENT_SCHEDULED", "BENEFIT_PENDING"] },
    },
    include: { program: true },
  });

  if (!referral && patient.phone) {
    referral = await prisma.referral.findFirst({
      where: {
        clinicId: input.clinicId,
        leadPhone: patient.phone,
        referredId: null,
        status: { in: ["LEAD", "SUSPICIOUS"] },
        referrerId: { not: input.patientId },
      },
      include: { program: true },
    });
    if (referral) {
      referral = await prisma.referral.update({
        where: { id: referral.id },
        data: { referredId: input.patientId, status: "LEAD" },
        include: { program: true },
      });
    }
  }

  if (!referral) return null;
  if (referral.referrerId === input.patientId) return null;
  if (Number(referral.program.minFirstAppointment) > input.paidAmount) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: "BENEFIT_PENDING", appointmentId: input.appointmentId },
    });
    return null;
  }

  const already = await prisma.referral.findFirst({
    where: {
      clinicId: input.clinicId,
      referredId: input.patientId,
      status: { in: ["CONVERTED", "BENEFIT_GRANTED"] },
    },
  });
  if (already && already.id !== referral.id) return already;

  const priorGrant = await prisma.referral.findFirst({
    where: {
      id: referral.id,
      status: { in: ["CONVERTED", "BENEFIT_GRANTED"] },
    },
  });
  if (priorGrant) return priorGrant;

  const referrerWallet = await prisma.wallet.findFirst({
    where: { clinicId: input.clinicId, patientId: referral.referrerId },
  });
  const referredWallet = await prisma.wallet.findFirst({
    where: { clinicId: input.clinicId, patientId: input.patientId },
  });
  if (!referrerWallet || !referredWallet) return null;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + referral.program.benefitValidityDays);

  if (Number(referral.program.referrerCashback) > 0 || referral.program.referrerPoints > 0) {
    await creditWallet({
      clinicId: input.clinicId,
      walletId: referrerWallet.id,
      patientId: referral.referrerId,
      amount: Number(referral.program.referrerCashback) || 0,
      points: referral.program.referrerPoints,
      type: "CREDIT_REFERRAL",
      origin: "referral",
      reason: "Benefício indicação (indicador)",
      availableAt: new Date(),
      expiresAt,
      idempotencyKey: `referral-referrer:${referral.id}`,
    });
  }
  if (Number(referral.program.referredCashback) > 0 || referral.program.referredPoints > 0) {
    await creditWallet({
      clinicId: input.clinicId,
      walletId: referredWallet.id,
      patientId: input.patientId,
      amount: Number(referral.program.referredCashback) || 0,
      points: referral.program.referredPoints,
      type: "CREDIT_REFERRAL",
      origin: "referral",
      reason: "Benefício indicação (indicado)",
      availableAt: new Date(),
      expiresAt,
      idempotencyKey: `referral-referred:${referral.id}`,
    });
  }

  const updated = await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: "BENEFIT_GRANTED",
      convertedAt: new Date(),
      benefitGrantedAt: new Date(),
      appointmentId: input.appointmentId,
      referredId: input.patientId,
    },
  });

  const indicador = await prisma.customerTag.findFirst({
    where: { clinicId: input.clinicId, slug: "indicador" },
  });
  const indicado = await prisma.customerTag.findFirst({
    where: { clinicId: input.clinicId, slug: "indicado" },
  });
  if (indicador) {
    await assignTag({
      clinicId: input.clinicId,
      patientId: referral.referrerId,
      tagId: indicador.id,
      source: "AUTOMATIC",
    });
  }
  if (indicado) {
    await assignTag({
      clinicId: input.clinicId,
      patientId: input.patientId,
      tagId: indicado.id,
      source: "AUTOMATIC",
    });
  }

  await runAutomationsForTrigger({
    clinicId: input.clinicId,
    trigger: "REFERRAL_CONVERTED",
    patientId: referral.referrerId,
    triggerRef: referral.id,
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    action: "REFERRAL_CONVERT",
    entityType: "Referral",
    entityId: updated.id,
    afterData: { appointmentId: input.appointmentId },
  });

  return updated;
}

export async function referralFunnel(clinicId: string) {
  const groups = await prisma.referral.groupBy({
    by: ["status"],
    where: { clinicId },
    _count: true,
  });
  return Object.fromEntries(groups.map((g) => [g.status, g._count]));
}

export async function listReferrals(clinicId: string) {
  return prisma.referral.findMany({
    where: { clinicId },
    include: {
      referrer: { select: { id: true, fullName: true, phone: true } },
      referred: { select: { id: true, fullName: true, phone: true } },
      program: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
