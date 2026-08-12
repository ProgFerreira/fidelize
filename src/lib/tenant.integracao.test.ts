import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { extensaoTenant, _internos } from "@/lib/prisma-tenant";
import {
  comOrganizacao,
  semOrganizacao,
  SemContextoTenantError,
} from "@/lib/tenant";

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
  });
  return new PrismaClient({ adapter }).$extends(extensaoTenant);
}

const runDb = process.env.RUN_DB_TESTS === "1";
const prisma = createClient();

const ORG_A = "org_test_a_tenant_iso";
const ORG_B = "org_test_b_tenant_iso";

async function limpar() {
  await semOrganizacao(async () => {
    await prisma.unit.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    });
    await prisma.clinic.deleteMany({
      where: { organizationId: { in: [ORG_A, ORG_B] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ORG_A, ORG_B] } },
    });
  });
}

async function montarCenario() {
  await limpar();
  await semOrganizacao(async () => {
    await prisma.organization.create({
      data: { id: ORG_A, slug: "tenant-a-test", name: "Tenant A", plan: "trial" },
    });
    await prisma.organization.create({
      data: { id: ORG_B, slug: "tenant-b-test", name: "Tenant B", plan: "trial" },
    });
  });

  await comOrganizacao({ organizationId: ORG_A }, async () => {
    await prisma.clinic.create({
      data: { name: "Clinica A", slug: "clinica-a-test" },
    });
  });
  await comOrganizacao({ organizationId: ORG_B }, async () => {
    await prisma.clinic.create({
      data: { name: "Clinica B", slug: "clinica-b-test" },
    });
  });
}

describe.runIf(runDb)("tenant isolation", () => {
  beforeAll(async () => {
    await montarCenario();
  });

  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  it("fail-closed sem contexto", async () => {
    await expect(prisma.clinic.findMany()).rejects.toBeInstanceOf(
      SemContextoTenantError,
    );
  });

  it("semOrganizacao escapa o isolamento", async () => {
    const orgs = await semOrganizacao(() =>
      prisma.organization.findMany({
        where: { id: { in: [ORG_A, ORG_B] } },
      }),
    );
    expect(orgs).toHaveLength(2);
  });

  it("não lista clínica de outra org", async () => {
    const rows = await comOrganizacao({ organizationId: ORG_A }, () =>
      prisma.clinic.findMany(),
    );
    expect(rows.every((r) => r.organizationId === ORG_A)).toBe(true);
    expect(rows.some((r) => r.name === "Clinica B")).toBe(false);
  });

  it("create sobrescreve organizationId do input", async () => {
    const clinic = await comOrganizacao({ organizationId: ORG_A }, () =>
      prisma.clinic.create({
        data: {
          name: "Tentativa Cross",
          organizationId: ORG_B,
        } as { name: string; organizationId: string },
      }),
    );
    expect(clinic.organizationId).toBe(ORG_A);
    await comOrganizacao({ organizationId: ORG_A }, () =>
      prisma.clinic.delete({ where: { id: clinic.id } }),
    );
  });

  it("where.organizationId de outra org devolve vazio", async () => {
    const rows = await comOrganizacao({ organizationId: ORG_A }, () =>
      prisma.clinic.findMany({ where: { organizationId: ORG_B } }),
    );
    expect(rows).toHaveLength(0);
  });

  it("extensão cobre models com organizationId", () => {
    expect(_internos.MODELOS_TENANT.has("Clinic")).toBe(true);
    expect(_internos.MODELOS_TENANT.has("Patient")).toBe(true);
    expect(_internos.MODELOS_TENANT.has("Permission")).toBe(false);
  });
});
