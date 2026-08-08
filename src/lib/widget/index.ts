import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { verifyApiKey } from "@/lib/integrations";

export const widgetOriginSchema = z.object({
  origin: z.string().url().or(z.string().regex(/^https?:\/\/.+/)),
});

export async function addWidgetOrigin(input: {
  clinicId: string;
  actorId?: string;
  origin: string;
}) {
  const origin = input.origin.replace(/\/$/, "");
  const row = await prisma.widgetOrigin.upsert({
    where: { clinicId_origin: { clinicId: input.clinicId, origin } },
    create: { clinicId: input.clinicId, origin, active: true },
    update: { active: true },
  });
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "OTHER",
    entityType: "WidgetOrigin",
    entityId: row.id,
    afterData: { origin },
  });
  return row;
}

export async function listWidgetOrigins(clinicId: string) {
  return prisma.widgetOrigin.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
  });
}

export async function isOriginAllowed(clinicId: string, origin: string | null) {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  const row = await prisma.widgetOrigin.findFirst({
    where: {
      clinicId,
      active: true,
      OR: [{ origin: normalized }, { origin: "*" }],
    },
  });
  return Boolean(row);
}

/** Dados públicos read-only para widget (saldo/categoria) */
export async function getWidgetPatientSnapshot(input: {
  apiKey: string;
  patientId?: string;
  phone?: string;
  origin?: string | null;
}) {
  const cred = await verifyApiKey(input.apiKey);
  if (!cred || cred.rateLimited) return null;
  if (input.origin && !(await isOriginAllowed(cred.clinicId, input.origin))) {
    return { error: "origin_not_allowed" as const };
  }

  const patient = await prisma.patient.findFirst({
    where: {
      clinicId: cred.clinicId,
      ...(input.patientId ? { id: input.patientId } : {}),
      ...(input.phone ? { phone: input.phone.replace(/\D/g, "") } : {}),
    },
    include: {
      wallets: {
        include: { category: { select: { name: true, slug: true } } },
        take: 1,
      },
    },
  });
  if (!patient) return null;

  const wallet = patient.wallets[0];
  return {
    clinicId: cred.clinicId,
    patient: {
      id: patient.id,
      firstName: patient.fullName.split(" ")[0],
    },
    balance: wallet?.availableBalance ?? "0",
    points: wallet?.pointsBalance ?? 0,
    category: wallet?.category ?? null,
  };
}

export function widgetEmbedSnippet(baseUrl: string, apiKeyPlaceholder = "SUA_CHAVE") {
  return `<!-- Fidelize Widget -->
<script>
(function(){
  var s=document.createElement('iframe');
  s.src="${baseUrl}/embed/widget?key=${apiKeyPlaceholder}";
  s.style.cssText="border:0;width:320px;height:140px;border-radius:12px";
  s.title="Clube de Benefícios";
  document.currentScript.parentNode.insertBefore(s, document.currentScript);
})();
</script>`;
}
