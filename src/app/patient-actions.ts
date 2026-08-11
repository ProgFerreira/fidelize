"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requestPatientOtp, verifyPatientOtp } from "@/lib/otp";
import { setPatientSession, clearPatientSession, getPatientSession } from "@/lib/otp/session";
import { buscarClinicaPorHost } from "@/lib/organization";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

async function resolvePatientClinic() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const clinic = await buscarClinicaPorHost(host);
  if (clinic) return clinic;

  // Fallback: first active clinic of org from slug header subdomain resolution
  return semOrganizacao(() =>
    prisma.clinic.findFirst({
      where: { active: true, slug: { not: null } },
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

export async function requestOtpAction(formData: FormData) {
  const phone = String(formData.get("phone") || "");
  const clinic = await resolvePatientClinic();
  if (!clinic?.organizationId) throw new Error("Clínica indisponível");

  return comOrganizacao({ organizationId: clinic.organizationId }, () =>
    requestPatientOtp({ clinicId: clinic.id, phone }),
  );
}

export async function verifyOtpAction(formData: FormData) {
  const phone = String(formData.get("phone") || "");
  const code = String(formData.get("code") || "");
  const clinic = await resolvePatientClinic();
  if (!clinic?.organizationId) throw new Error("Clínica indisponível");

  const patient = await comOrganizacao(
    { organizationId: clinic.organizationId },
    () =>
      verifyPatientOtp({
        clinicId: clinic.id,
        phone,
        code,
      }),
  );

  await setPatientSession({
    patientId: patient.id,
    clinicId: clinic.id,
    fullName: patient.fullName,
  });

  redirect("/p");
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

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.clinicId },
    select: { organizationId: true },
  });
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

  redirect("/p/perfil");
}

export async function exportMyDataAction() {
  const session = await getPatientSession();
  if (!session) redirect("/paciente");

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.clinicId },
    select: { organizationId: true },
  });
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

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.clinicId },
    select: { organizationId: true },
  });
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
