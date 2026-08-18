"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requestPatientOtp, verifyPatientOtp } from "@/lib/otp";
import {
  setPatientSession,
  clearPatientSession,
  getPatientSession,
  safePatientCallbackUrl,
} from "@/lib/otp/session";
import {
  buscarClinicaPorHost,
  buscarOrganizacaoPorSlug,
  resolverHost,
} from "@/lib/organization";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

async function resolvePatientClinic() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const clinic = await buscarClinicaPorHost(host);
  if (clinic) return clinic;

  const resolved = resolverHost(host);
  if (resolved.tipo !== "organizacao") return null;
  const org = await buscarOrganizacaoPorSlug(resolved.slug);
  if (!org) return null;

  return semOrganizacao(() =>
    prisma.clinic.findFirst({
      where: { organizationId: org.id, active: true },
      select: {
        id: true,
        organizationId: true,
        slug: true,
        name: true,
        customDomain: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  );
}

function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Erros lançados dentro de Server Actions chegam ao client redigidos em
 * produção (Next.js troca a mensagem original por um erro genérico, tipo
 * "Minified React error #441" — de propósito, pra não vazar detalhes de
 * implementação). Por isso essas duas actions NUNCA lançam pra sinalizar
 * erro esperado (clínica indisponível, código errado etc.) — sempre
 * devolvem `{ ok: false, error }`, que o client mostra direto.
 */
export async function requestOtpAction(
  formData: FormData,
): Promise<{ ok: true; simulatedCode?: string } | { ok: false; error: string }> {
  try {
    const phone = String(formData.get("phone") || "");
    const h = await headers();
    const clinic = await resolvePatientClinic();
    if (!clinic?.organizationId) {
      return { ok: false, error: "Clínica indisponível" };
    }

    const result = await comOrganizacao(
      { organizationId: clinic.organizationId },
      () => requestPatientOtp({ clinicId: clinic.id, phone, ip: clientIp(h) }),
    );
    return { ok: true, simulatedCode: result.simulatedCode };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao enviar código",
    };
  }
}

export async function verifyOtpAction(
  formData: FormData,
): Promise<{ ok: false; error: string } | void> {
  let redirectTo: string | null = null;

  try {
    const phone = String(formData.get("phone") || "");
    const code = String(formData.get("code") || "");
    const clinic = await resolvePatientClinic();
    if (!clinic?.organizationId) {
      return { ok: false, error: "Clínica indisponível" };
    }

    const patient = await comOrganizacao(
      { organizationId: clinic.organizationId },
      () => verifyPatientOtp({ clinicId: clinic.id, phone, code }),
    );

    await setPatientSession({
      patientId: patient.id,
      clinicId: clinic.id,
      fullName: patient.fullName,
    });

    const callbackUrl = safePatientCallbackUrl(
      String(formData.get("callbackUrl") || ""),
    );
    redirectTo = callbackUrl ?? "/p";
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao verificar código",
    };
  }

  // redirect() lança um sinal especial do Next.js — precisa ficar fora do
  // try/catch acima, senão o catch genérico o intercepta como erro comum.
  redirect(redirectTo);
}

export async function patientLogoutAction() {
  await clearPatientSession();
  redirect("/paciente");
}

export async function updatePatientPreferencesAction(formData: FormData) {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

  const marketing = formData.get("marketingConsent") === "on";
  const whatsapp = formData.get("whatsapp") === "on";
  const email = formData.get("email") === "on";
  const sms = formData.get("sms") === "on";

  const clinic = await semOrganizacao(() =>
    prisma.clinic.findFirst({
      where: { id: session.clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) throw new Error("Clínica inválida");

  await comOrganizacao({ organizationId: clinic.organizationId }, async () => {
    const { recordConsent } = await import("@/lib/consent");
    await recordConsent({
      clinicId: session.clinicId,
      data: {
        patientId: session.patientId,
        purpose: "MARKETING",
        accepted: marketing,
        origin: "patient_portal",
        textAccepted: "Preferência atualizada no portal do paciente",
        version: "portal-1",
      },
    });
    for (const [channel, allowed] of [
      ["WHATSAPP", whatsapp],
      ["EMAIL", email],
      ["SMS", sms],
    ] as const) {
      await recordConsent({
        clinicId: session.clinicId,
        data: {
          patientId: session.patientId,
          purpose: "MARKETING",
          channel,
          accepted: marketing && allowed,
          origin: "patient_portal",
          version: "portal-1",
        },
      });
    }
  });

  redirect("/p/perfil?ok=salvo");
}

export async function exportMyDataAction() {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

  const clinic = await semOrganizacao(() =>
    prisma.clinic.findFirst({
      where: { id: session.clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) throw new Error("Clínica inválida");

  const { exportPatientData } = await import("@/lib/lgpd");
  const data = await comOrganizacao({ organizationId: clinic.organizationId }, () =>
    exportPatientData({
      clinicId: session.clinicId,
      patientId: session.patientId,
    }),
  );

  return data;
}

export async function anonymizeMyDataAction() {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

  const clinic = await semOrganizacao(() =>
    prisma.clinic.findFirst({
      where: { id: session.clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) throw new Error("Clínica inválida");

  const { anonymizePatient } = await import("@/lib/lgpd");
  const { revokeAllMobileSessionsForPatient } = await import("@/lib/mobile/session");

  await comOrganizacao({ organizationId: clinic.organizationId }, async () => {
    await anonymizePatient({
      clinicId: session.clinicId,
      patientId: session.patientId,
      reason: "solicitacao_portal_paciente",
    });
    await revokeAllMobileSessionsForPatient({
      clinicId: session.clinicId,
      patientId: session.patientId,
    });
  });

  await clearPatientSession();
  redirect("/paciente?lgpd=anonimizado");
}
