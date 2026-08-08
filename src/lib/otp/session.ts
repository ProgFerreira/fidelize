import { cookies } from "next/headers";
import { createHash } from "crypto";

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
