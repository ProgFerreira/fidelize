import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/patients";
import { writeAuditLog } from "@/lib/audit";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function requestPatientOtp(params: {
  clinicId: string;
  phone: string;
}) {
  const phone = onlyDigits(params.phone);
  const patient = await prisma.patient.findFirst({
    where: {
      clinicId: params.clinicId,
      phone: { endsWith: phone.slice(-9) },
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!patient) {
    throw new Error("Paciente não encontrado com este telefone");
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

  await writeAuditLog({
    clinicId: params.clinicId,
    action: "OTP_REQUEST",
    entityType: "Patient",
    entityId: patient.id,
    metadata: { phone: patient.phone },
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

  return {
    patientId: patient.id,
    phone: patient.phone,
    expiresAt,
    simulatedCode:
      process.env.NODE_ENV === "production" && !delivery.simulated
        ? undefined
        : code,
    message: delivery.simulated
      ? "Código gerado (provedor simulado — configure WHATSAPP_TOKEN ou Twilio)."
      : `Código enviado via ${delivery.channel}.`,
    delivery,
  };
}

export async function verifyPatientOtp(params: {
  clinicId: string;
  phone: string;
  code: string;
}) {
  const phone = onlyDigits(params.phone);
  const otp = await prisma.patientOtp.findFirst({
    where: {
      clinicId: params.clinicId,
      phone: { endsWith: phone.slice(-9) },
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

  if (otp.codeHash !== hashCode(params.code)) {
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
