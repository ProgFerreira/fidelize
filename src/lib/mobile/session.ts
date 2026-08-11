import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createMobileSession(input: {
  clinicId: string;
  patientId: string;
}) {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.mobileSession.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      tokenHash,
      expiresAt,
    },
  });

  return { sessionToken: raw, expiresAt };
}

export async function verifyMobileSession(input: {
  clinicId: string;
  sessionToken: string;
}) {
  if (!input.sessionToken) return null;
  const tokenHash = hashToken(input.sessionToken);
  const row = await prisma.mobileSession.findFirst({
    where: {
      clinicId: input.clinicId,
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) return null;

  await prisma.mobileSession.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    sessionId: row.id,
    patientId: row.patientId,
    clinicId: row.clinicId,
  };
}

export async function revokeMobileSession(input: {
  clinicId: string;
  sessionToken: string;
}) {
  const tokenHash = hashToken(input.sessionToken);
  await prisma.mobileSession.updateMany({
    where: { clinicId: input.clinicId, tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllMobileSessionsForPatient(input: {
  clinicId: string;
  patientId: string;
}) {
  await prisma.mobileSession.updateMany({
    where: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
