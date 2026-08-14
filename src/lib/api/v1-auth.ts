import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiKey } from "@/lib/integrations";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

type CredencialApi = NonNullable<Awaited<ReturnType<typeof verifyApiKey>>>;

export async function credencialApiV1(request: Request): Promise<
  | { cred: CredencialApi }
  | { erro: NextResponse }
> {
  const key = request.headers.get("x-api-key") || "";
  if (!key) {
    return {
      erro: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const cred = await semOrganizacao(() => verifyApiKey(key));
  if (!cred) {
    return {
      erro: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (cred.rateLimited) {
    return {
      erro: NextResponse.json({ error: "Rate limit" }, { status: 429 }),
    };
  }
  return { cred };
}

export async function comClinicaDaApi<T>(
  clinicId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const clinic = await semOrganizacao(() =>
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) {
    throw new Error("Clínica sem organização");
  }
  return comOrganizacao({ organizationId: clinic.organizationId }, fn);
}
