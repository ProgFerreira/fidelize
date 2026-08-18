import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/patients";
import { writeAuditLog } from "@/lib/audit";

const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_PER_PHONE = 5;
const OTP_MAX_PER_IP = 10;
const GENERIC_SENT =
  "Se o telefone estiver cadastrado, enviaremos um código.";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function hashesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function phoneCandidates(phone: string): string[] {
  const digits = onlyDigits(phone);
  if (!digits) return [];
  const out = new Set<string>([digits]);
  if (digits.startsWith("55") && digits.length >= 12) {
    out.add(digits.slice(2));
  } else if (digits.length >= 10 && digits.length <= 11) {
    out.add(`55${digits}`);
  }
  return [...out];
}

export async function requestPatientOtp(params: {
  clinicId: string;
  phone: string;
  ip?: string | null;
}) {
  const candidates = phoneCandidates(params.phone);
  const since = new Date(Date.now() - OTP_WINDOW_MS);

  if (params.ip) {
    const byIp = await prisma.auditLog.count({
      where: {
        action: "OTP_REQUEST",
        ipAddress: params.ip,
        createdAt: { gte: since },
      },
    });
    if (byIp >= OTP_MAX_PER_IP) {
      throw new Error("Muitas tentativas. Aguarde alguns minutos.");
    }
  }

  if (candidates.length) {
    const byPhone = await prisma.patientOtp.count({
      where: {
        clinicId: params.clinicId,
        phone: { in: candidates },
        createdAt: { gte: since },
      },
    });
    if (byPhone >= OTP_MAX_PER_PHONE) {
      throw new Error("Muitas tentativas. Aguarde alguns minutos.");
    }
  }

  const patient =
    candidates.length === 0
      ? null
      : await prisma.patient.findFirst({
          where: {
            clinicId: params.clinicId,
            status: "ACTIVE",
            phone: { in: candidates },
          },
          orderBy: { createdAt: "desc" },
        });

  await writeAuditLog({
    clinicId: params.clinicId,
    action: "OTP_REQUEST",
    entityType: "Patient",
    entityId: patient?.id,
    ipAddress: params.ip,
    metadata: { phone: candidates[0] ?? null, found: Boolean(patient) },
  });

  if (!patient) {
    return {
      sent: true as const,
      simulatedCode: undefined as string | undefined,
      message: GENERIC_SENT,
    };
  }

  // Se o profissional já gerou e repassou um código válido por WhatsApp
  // (requestStaffOtpForPatient), não gera outro nem mostra nada na tela —
  // o paciente precisa pegar o código que já recebeu por um canal real.
  // Não reusa código de uma solicitação normal anterior: mantém o
  // comportamento atual pra quem ainda não usa o repasse por staff.
  const jaEnviadoPeloStaff = await prisma.patientOtp.findFirst({
    where: {
      clinicId: params.clinicId,
      patientId: patient.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
      generatedByStaff: true,
    },
  });
  if (jaEnviadoPeloStaff) {
    return {
      sent: true as const,
      simulatedCode: undefined as string | undefined,
      message: GENERIC_SENT,
    };
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.patientOtp.create({
    data: {
      clinicId: params.clinicId,
      patientId: patient.id,
      phone: patient.phone,
      codeHash: hashCode(code),
      expiresAt,
    },
  });

  const body = `Seu código do clube de benefícios: ${code}. Válido por 10 minutos.`;
  let delivery: { channel: string; simulated: boolean } = {
    channel: "simulated",
    simulated: true,
  };
  try {
    const { dispatchProvider } = await import("@/lib/providers");
    const { isModuleEnabled } = await import("@/lib/modules");
    if (await isModuleEnabled(params.clinicId, "WHATSAPP")) {
      const send = await dispatchProvider({
        clinicId: params.clinicId,
        channel: "WHATSAPP",
        to: patient.phone,
        body,
      });
      delivery = { channel: "WHATSAPP", simulated: send.simulated };
    } else if (await isModuleEnabled(params.clinicId, "SMS")) {
      const send = await dispatchProvider({
        clinicId: params.clinicId,
        channel: "SMS",
        to: patient.phone,
        body,
      });
      delivery = { channel: "SMS", simulated: send.simulated };
    }
  } catch {
    // fallback simulado
  }

  // TEMPORÁRIO/INSEGURO: enquanto não há WhatsApp/SMS/E-mail real
  // configurado, o código só chega ao paciente se OTP_SHOW_CODE_INSECURE=true
  // estiver setado no ambiente — aí ele volta na resposta e aparece na tela,
  // mesmo em produção. Isso derrota o propósito do OTP como segundo fator
  // (qualquer um vendo a tela vê o código). Remover essa variável do
  // hostinger.env assim que um canal de entrega real estiver configurado.
  const exporCodigoInseguro = process.env.OTP_SHOW_CODE_INSECURE === "true";
  const simulatedCode =
    delivery.simulated && (exporCodigoInseguro || process.env.NODE_ENV !== "production")
      ? code
      : undefined;

  return {
    sent: true as const,
    simulatedCode,
    message: GENERIC_SENT,
  };
}

/**
 * Gera um código de acesso pra um paciente já identificado, pra o profissional
 * repassar manualmente (ex.: link wa.me) — não depende de WhatsApp/SMS
 * automatizado configurado. Sempre gera um código novo e retorna o texto
 * puro: quem chama já está autenticado como staff e vai repassar na hora.
 */
export async function requestStaffOtpForPatient(params: {
  clinicId: string;
  patientId: string;
  actorId?: string;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, clinicId: params.clinicId },
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.patientOtp.create({
    data: {
      clinicId: params.clinicId,
      patientId: patient.id,
      phone: patient.phone,
      codeHash: hashCode(code),
      expiresAt,
      generatedByStaff: true,
    },
  });

  await writeAuditLog({
    clinicId: params.clinicId,
    userId: params.actorId,
    action: "OTP_REQUEST",
    entityType: "Patient",
    entityId: patient.id,
    metadata: { generatedByStaff: true },
  });

  return {
    code,
    patient: { fullName: patient.fullName, phone: patient.phone },
  };
}

export async function verifyPatientOtp(params: {
  clinicId: string;
  phone: string;
  code: string;
}) {
  const candidates = phoneCandidates(params.phone);
  const otp = await prisma.patientOtp.findFirst({
    where: {
      clinicId: params.clinicId,
      phone: { in: candidates.length ? candidates : ["__none__"] },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      patient: {
        include: {
          wallets: {
            where: { status: "ACTIVE" },
            include: { category: true, cards: { where: { status: "ACTIVE" } } },
          },
        },
      },
    },
  });

  if (!otp) throw new Error("Código expirado ou inválido");
  if (otp.attempts >= 5) throw new Error("Muitas tentativas. Solicite um novo código.");

  if (!hashesMatch(otp.codeHash, hashCode(params.code))) {
    await prisma.patientOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error("Código inválido");
  }

  await prisma.patientOtp.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });

  return otp.patient;
}
