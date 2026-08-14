import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { estabelecerOrganizacao, semOrganizacao } from "@/lib/tenant";
import { hmacSha256Base64Url } from "@/lib/security/secrets";

const COOKIE = "patient_session";

export type PatientSession = {
  patientId: string;
  clinicId: string;
  fullName: string;
};

function authSecret(): string | null {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
}

function sign(payload: string, secret: string) {
  return hmacSha256Base64Url(secret, payload);
}

function signaturesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function setPatientSession(session: PatientSession) {
  const secret = authSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET ausente — sessão do paciente não pode ser assinada");
  }
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const token = `${payload}.${sign(payload, secret)}`;
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
  const secret = authSecret();
  if (!secret) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!payload || !signature || !signaturesMatch(sign(payload, secret), signature)) {
    return null;
  }
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as PatientSession;
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
    prisma.clinic.findFirst({
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
