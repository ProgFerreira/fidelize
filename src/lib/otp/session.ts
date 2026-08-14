import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { estabelecerOrganizacao, semOrganizacao } from "@/lib/tenant";

const COOKIE = "patient_session";

export type PatientSession = {
  patientId: string;
  clinicId: string;
  fullName: string;
};

function sign(payload: string) {
  const secret = process.env.AUTH_SECRET ?? "dev";
  return createHash("sha256").update(`${payload}.${secret}`).digest("hex").slice(0, 24);
}

export async function setPatientSession(session: PatientSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearPatientSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getPatientSession(): Promise<PatientSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PatientSession;
  } catch {
    return null;
  }
}

/**
 * A sessão do portal do paciente só carrega `clinicId` — diferente da sessão
 * staff (NextAuth), nada estabelece o contexto de organização automaticamente.
 * Chame isto uma vez por request (ex.: no layout de `/p`) antes de qualquer
 * leitura tenant-scoped, senão toda query lança SemContextoTenantError.
 */
export async function establishPatientTenantContext(clinicId: string) {
  const clinic = await semOrganizacao(() =>
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { organizationId: true },
    }),
  );
  if (clinic?.organizationId) {
    await estabelecerOrganizacao({ organizationId: clinic.organizationId });
  }
}

/**
 * Uso padrão em toda page/Server Action do portal do paciente: busca a
 * sessão, redireciona se ausente, e já estabelece o contexto de organização
 * antes de devolver. Next.js não garante que o layout termine de rodar antes
 * da page — cada page/action precisa chamar isto por conta própria, não dá
 * pra confiar só no layout pai.
 */
export async function requirePatientSession(
  callbackUrl?: string,
): Promise<PatientSession> {
  const session = await getPatientSession();
  if (!session) {
    redirect(
      callbackUrl
        ? `/paciente?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "/paciente",
    );
  }
  await establishPatientTenantContext(session.clinicId);
  return session;
}

/**
 * Só aceita caminho relativo interno (ex.: "/p/videochamadas/abc") — nunca
 * URL absoluta/protocol-relative, senão vira open redirect.
 */
export function safePatientCallbackUrl(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return null;
  }
  return value;
}
