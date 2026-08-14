import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createPatient } from "@/lib/patients";
import { parseConsentimentoCsv } from "@/lib/patients/csv-consent";
import { onlyDigits } from "@/lib/patients/cpf";

/**
 * Importação CSV. Primeira linha é cabeçalho.
 * Colunas: fullName,cpf,phone,email,externalCode[,regulationConsent,marketingConsent]
 * Sem coluna de consentimento (ou valor diferente de sim/true/1/yes) → false.
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

  const header = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const colRegulamento = header.indexOf("regulationconsent");
  const colMarketing = header.indexOf("marketingconsent");
  const rows = lines.slice(1);
  const created: string[] = [];
  const errors: Array<{ line: number; error: string }> = [];

  if (!session.user.clinicId) {
    return NextResponse.json({ error: "Clínica não definida na sessão" }, { status: 400 });
  }
  if (!session.user.organizationId) {
    return NextResponse.json({ error: "Organização não definida na sessão" }, { status: 400 });
  }

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(",").map((c) => c.trim());
    const [fullName, cpf, phone, email, externalCode] = cols;
    try {
      const patient = await createPatient({
        clinicId: session.user.clinicId,
        actorId: session.user.id,
        organizationId: session.user.organizationId,
        data: {
          fullName,
          cpf: onlyDigits(cpf),
          phone: onlyDigits(phone),
          email: email || null,
          externalCode: externalCode || null,
          regulationConsent: parseConsentimentoCsv(
            colRegulamento >= 0 ? cols[colRegulamento] : cols[5],
          ),
          marketingConsent: parseConsentimentoCsv(
            colMarketing >= 0 ? cols[colMarketing] : cols[6],
          ),
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
