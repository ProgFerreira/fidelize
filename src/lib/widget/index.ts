import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { verifyApiKey } from "@/lib/integrations";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

export const widgetOriginSchema = z.object({
  origin: z.string().url().or(z.string().regex(/^https?:\/\/.+/)),
});

function normalizeOrigin(origin: string) {
  return origin.replace(/\/$/, "");
}

/** Extrai origem a partir de Origin ou Referer (iframe embed). */
export function extractRequestOrigin(request: {
  headers: Headers;
}): string | null {
  const origin = request.headers.get("origin");
  if (origin) return normalizeOrigin(origin);
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return normalizeOrigin(url.origin);
  } catch {
    return null;
  }
}

export async function addWidgetOrigin(input: {
  clinicId: string;
  actorId?: string;
  origin: string;
}) {
  const origin = normalizeOrigin(input.origin);
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

/**
 * Valor do header `Content-Security-Policy: frame-ancestors ...` para a
 * clínica. Sem origens cadastradas → `'none'`.
 */
export async function frameAncestorsFor(
  clinicId: string | null,
): Promise<string> {
  if (!clinicId) return "'none'";

  const origins = await listWidgetOrigins(clinicId);
  const ativas = origins.filter((o) => o.active).map((o) => o.origin);

  if (ativas.length === 0) return "'none'";
  if (ativas.includes("*")) return "*";

  return ativas.join(" ");
}

export async function isOriginAllowed(clinicId: string, origin: string | null) {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  const row = await prisma.widgetOrigin.findFirst({
    where: {
      clinicId,
      active: true,
      OR: [{ origin: normalized }, { origin: "*" }],
    },
  });
  return Boolean(row);
}

async function resolveClinicForWidget(clinicSlugOrId: string) {
  return semOrganizacao(() =>
    prisma.clinic.findFirst({
      where: {
        active: true,
        OR: [{ slug: clinicSlugOrId }, { id: clinicSlugOrId }],
      },
      select: { id: true, organizationId: true, slug: true, name: true },
    }),
  );
}

async function loadPatientSnapshot(input: {
  clinicId: string;
  organizationId: string;
  patientId?: string;
  phone?: string;
}) {
  if (!input.patientId && !input.phone) return null;

  return comOrganizacao({ organizationId: input.organizationId }, async () => {
    const patient = await prisma.patient.findFirst({
      where: {
        clinicId: input.clinicId,
        status: "ACTIVE",
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
      clinicId: input.clinicId,
      patient: {
        id: patient.id,
        firstName: patient.fullName.split(" ")[0],
      },
      balance: wallet?.availableBalance ?? "0",
      points: wallet?.pointsBalance ?? 0,
      category: wallet?.category ?? null,
    };
  });
}

/**
 * Snapshot público do widget sem API key na URL — autenticação = allowlist
 * de origem + slug da clínica.
 */
export async function getWidgetPatientSnapshotByClinic(input: {
  clinicSlug: string;
  patientId?: string;
  phone?: string;
  origin?: string | null;
}) {
  const clinic = await resolveClinicForWidget(input.clinicSlug);
  if (!clinic?.organizationId) return null;

  return comOrganizacao({ organizationId: clinic.organizationId }, async () => {
    if (!(await isOriginAllowed(clinic.id, input.origin ?? null))) {
      return { error: "origin_not_allowed" as const };
    }
    return loadPatientSnapshot({
      clinicId: clinic.id,
      organizationId: clinic.organizationId!,
      patientId: input.patientId,
      phone: input.phone,
    });
  });
}

/** Dados públicos read-only para widget (saldo/categoria) via API key (header). */
export async function getWidgetPatientSnapshot(input: {
  apiKey: string;
  patientId?: string;
  phone?: string;
  origin?: string | null;
}) {
  const cred = await semOrganizacao(() => verifyApiKey(input.apiKey));
  if (!cred || cred.rateLimited) return null;

  const clinic = await semOrganizacao(() =>
    prisma.clinic.findUnique({
      where: { id: cred.clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) return null;

  return comOrganizacao({ organizationId: clinic.organizationId }, async () => {
    if (!(await isOriginAllowed(cred.clinicId, input.origin ?? null))) {
      return { error: "origin_not_allowed" as const };
    }
    return loadPatientSnapshot({
      clinicId: cred.clinicId,
      organizationId: clinic.organizationId!,
      patientId: input.patientId,
      phone: input.phone,
    });
  });
}

export function widgetEmbedSnippet(
  baseUrl: string,
  clinicSlug = "SUA_CLINICA",
) {
  return `<!-- Fidelize Widget — sem API key na URL; origem deve estar allowlistada -->
<script>
(function(){
  var s=document.createElement('iframe');
  s.src="${baseUrl}/embed/widget?clinic=${clinicSlug}&patientId=PACIENTE_ID";
  s.style.cssText="border:0;width:320px;height:140px;border-radius:12px";
  s.title="Clube de Benefícios";
  s.referrerPolicy="strict-origin-when-cross-origin";
  document.currentScript.parentNode.insertBefore(s, document.currentScript);
})();
</script>`;
}
