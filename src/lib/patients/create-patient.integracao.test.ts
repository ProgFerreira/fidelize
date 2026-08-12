import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { extensaoTenant } from "@/lib/prisma-tenant";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { createPatient } from "@/lib/patients";

function createClient() {
  const url = process.env.DATABASE_URL!;
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
    charset: "utf8mb4",
    collation: "UTF8MB4_UNICODE_CI",
    connectionLimit: 3,
  });
  return new PrismaClient({ adapter }).$extends(extensaoTenant);
}

const runDb = process.env.RUN_DB_TESTS === "1";
const prisma = createClient();

function validCpf(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  let s1 = 0;
  for (let i = 0; i < 9; i++) s1 += n[i]! * (10 - i);
  let d1 = s1 % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  let s2 = 0;
  for (let i = 0; i < 9; i++) s2 += n[i]! * (11 - i);
  s2 += d1 * 2;
  let d2 = s2 % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return [...n, d1, d2].join("");
}

describe.runIf(runDb)("createPatient", () => {
  let clinicId = "";
  let organizationId = "";
  let actorId = "";
  const createdIds: string[] = [];

  beforeAll(async () => {
    const clinic = await semOrganizacao(() =>
      prisma.clinic.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      }),
    );
    if (!clinic?.organizationId) {
      throw new Error("Nenhuma clínica ativa no banco de teste");
    }
    clinicId = clinic.id;
    organizationId = clinic.organizationId;
    const admin = await semOrganizacao(() =>
      prisma.user.findFirst({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      }),
    );
    if (!admin) throw new Error("Nenhum usuário ativo para actorId");
    actorId = admin.id;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await comOrganizacao({ organizationId }, async () => {
        await prisma.wallet.deleteMany({
          where: { patientId: { in: createdIds } },
        });
        await prisma.consent.deleteMany({
          where: { patientId: { in: createdIds } },
        });
        await prisma.patient.deleteMany({
          where: { id: { in: createdIds } },
        });
      });
    }
    await prisma.$disconnect();
  });

  it("cria paciente + carteira com organizationId explícito", async () => {
    const cpf = validCpf();
    const phone = `1198${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const patient = await createPatient({
      clinicId,
      actorId,
      organizationId,
      data: {
        fullName: "Vitest Paciente Novo",
        cpf,
        phone,
        regulationConsent: true,
        marketingConsent: false,
        status: "ACTIVE",
      },
    });
    createdIds.push(patient.id);
    expect(patient.fullName).toBe("Vitest Paciente Novo");
    expect(patient.cpf).toBe(cpf);
    expect(patient.organizationId).toBe(organizationId);

    const wallet = await comOrganizacao({ organizationId }, () =>
      prisma.wallet.findFirst({
        where: { clinicId, patientId: patient.id },
      }),
    );
    expect(wallet).toBeTruthy();
    expect(wallet?.organizationId).toBe(organizationId);
  });

  it("rejeita CPF duplicado na mesma clínica", async () => {
    const cpf = validCpf();
    const phone = `1197${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const first = await createPatient({
      clinicId,
      actorId,
      organizationId,
      data: {
        fullName: "Vitest Duplicado A",
        cpf,
        phone,
        regulationConsent: true,
        marketingConsent: false,
        status: "ACTIVE",
      },
    });
    createdIds.push(first.id);

    await expect(
      createPatient({
        clinicId,
        actorId,
        organizationId,
        data: {
          fullName: "Vitest Duplicado B",
          cpf,
          phone: `1196${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
          regulationConsent: true,
          marketingConsent: false,
          status: "ACTIVE",
        },
      }),
    ).rejects.toThrow(/CPF/i);
  });
});
