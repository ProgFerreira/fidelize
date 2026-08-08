import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createPatient } from "@/lib/patients";
import { onlyDigits } from "@/lib/patients/cpf";

/**
 * Importação simples por CSV:
 * fullName,cpf,phone,email,externalCode
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.permissions.includes(PERMISSIONS.PATIENTS_WRITE)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const text = await request.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV vazio" }, { status: 400 });
  }

  const [, ...rows] = lines;
  const created: string[] = [];
  const errors: Array<{ line: number; error: string }> = [];

  if (!session.user.clinicId) {
    return NextResponse.json({ error: "Clínica não definida na sessão" }, { status: 400 });
  }

  for (let i = 0; i < rows.length; i++) {
    const [fullName, cpf, phone, email, externalCode] = rows[i]
      .split(",")
      .map((c) => c.trim());
    try {
      const patient = await createPatient({
        clinicId: session.user.clinicId,
        actorId: session.user.id,
        data: {
          fullName,
          cpf: onlyDigits(cpf),
          phone: onlyDigits(phone),
          email: email || null,
          externalCode: externalCode || null,
          regulationConsent: true,
          marketingConsent: false,
          status: "ACTIVE",
        },
      });
      created.push(patient.id);
    } catch (e) {
      errors.push({
        line: i + 2,
        error: e instanceof Error ? e.message : "Erro",
      });
    }
  }

  return NextResponse.json({
    created: created.length,
    errors,
  });
}
