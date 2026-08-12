import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  type PermissionCode,
} from "@/lib/auth/permissions";
import { semOrganizacao } from "@/lib/tenant";

const ORG_ID = "org_inicial_dermaphios_000";
const PLATFORM_ORG_ID = "org_plataforma_interno_000";
const ORG_SLUG = "dermaphios";

function walkDirs(startDir: string, max = 6): string[] {
  const dirs: string[] = [];
  let dir = startDir;
  for (let i = 0; i < max; i++) {
    dirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

export function findPrismaCli(cwd = process.cwd()): string | null {
  for (const dir of walkDirs(cwd)) {
    const candidates = [
      path.join(dir, "node_modules", "prisma", "build", "index.js"),
      path.join(dir, "node_modules", "prisma", "dist", "index.js"),
      path.join(dir, "node_modules", "prisma", "build", "index.cjs"),
    ];
    for (const file of candidates) {
      if (existsSync(file)) return file;
    }
  }
  return null;
}

export function findTsxCli(cwd = process.cwd()): string | null {
  for (const dir of walkDirs(cwd)) {
    const candidates = [
      path.join(dir, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(dir, "node_modules", "tsx", "dist", "cli.js"),
    ];
    for (const file of candidates) {
      if (existsSync(file)) return file;
    }
  }
  return null;
}

function findMigrationsDir(cwd = process.cwd()): string | null {
  for (const dir of walkDirs(cwd)) {
    const candidate = path.join(dir, "prisma", "migrations");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s));
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint | number }>>(
    `SELECT COUNT(*) AS c
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    table,
  );
  const count = Number(rows[0]?.c ?? 0);
  return count > 0;
}

export async function diagnoseDb() {
  const hasMigrationsTable = await tableExists("_prisma_migrations").catch(
    () => false,
  );
  const hasUserTable = await tableExists("User").catch(() => false);
  const hasOrganizationTable = await tableExists("Organization").catch(
    () => false,
  );

  let userCount: number | null = null;
  let orgCount: number | null = null;
  let hasDermaphiosAdmin: boolean | null = null;

  if (hasUserTable) {
    userCount = await semOrganizacao(() => prisma.user.count());
    hasDermaphiosAdmin = Boolean(
      await semOrganizacao(() =>
        prisma.user.findFirst({
          where: { email: "admin@dermaphios.com" },
          select: { id: true },
        }),
      ),
    );
  }
  if (hasOrganizationTable) {
    orgCount = await semOrganizacao(() => prisma.organization.count());
  }

  return {
    prismaCli: findPrismaCli(),
    tsxCli: findTsxCli(),
    migrationsDir: findMigrationsDir(),
    hasMigrationsTable,
    hasUserTable,
    hasOrganizationTable,
    userCount,
    orgCount,
    hasDermaphiosAdmin,
  };
}

export async function applyMigrationsWithClient() {
  const migrationsDir = findMigrationsDir();
  if (!migrationsDir) {
    return { ok: false as const, error: "Pasta prisma/migrations não encontrada no deploy." };
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id VARCHAR(36) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      finished_at DATETIME(3) NULL,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT NULL,
      rolled_back_at DATETIME(3) NULL,
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      applied_steps_count INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (id)
    )
  `);

  const applied = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL`,
  );
  const appliedSet = new Set(applied.map((r) => r.migration_name));

  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const ran: string[] = [];
  for (const name of folders) {
    if (appliedSet.has(name)) continue;
    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, "utf8");
    const statements = splitSqlStatements(sql);
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count)
       VALUES (?, ?, ?, NOW(3), 0)`,
      id,
      "hostinger-bootstrap",
      name,
    );
    try {
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$executeRawUnsafe(
        `UPDATE _prisma_migrations
         SET finished_at = NOW(3), applied_steps_count = ?
         WHERE id = ?`,
        statements.length,
        id,
      );
      ran.push(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.$executeRawUnsafe(
        `UPDATE _prisma_migrations SET logs = ?, rolled_back_at = NOW(3) WHERE id = ?`,
        message.slice(0, 4000),
        id,
      );
      return {
        ok: false as const,
        error: `Falha na migration ${name}: ${message}`,
        ran,
      };
    }
  }

  return { ok: true as const, ran, skipped: [...appliedSet] };
}

export async function seedStaffUsers() {
  return semOrganizacao(async () => {
    const existingAdmin = await prisma.user.findFirst({
      where: { email: "admin@dermaphios.com" },
      select: { id: true },
    });
    if (existingAdmin) {
      return {
        ok: true as const,
        skipped: true,
        message: "Usuários staff já existem (admin@dermaphios.com).",
      };
    }

    const org =
      (await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })) ??
      (await prisma.organization.create({
        data: {
          id: ORG_ID,
          slug: ORG_SLUG,
          name: "Dermaphios",
          tradeName: "Dermaphios",
          document: "12.345.678/0001-90",
          plan: "profissional",
          active: true,
        },
      }));

    await prisma.organization.upsert({
      where: { slug: "_plataforma" },
      create: {
        id: PLATFORM_ORG_ID,
        slug: "_plataforma",
        name: "Plataforma Fidelize",
        plan: "enterprise",
        active: true,
      },
      update: {},
    });

    const clinic =
      (await prisma.clinic.findFirst({
        where: { organizationId: org.id, slug: ORG_SLUG },
      })) ??
      (await prisma.clinic.create({
        data: {
          organizationId: org.id,
          slug: ORG_SLUG,
          name: "Clínica Dermaphios",
          tradeName: "Dermaphios",
          document: "12.345.678/0001-90",
          email: "contato@dermaphios.com",
          phone: "1133334444",
          timezone: "America/Sao_Paulo",
        },
      }));

    const unit =
      (await prisma.unit.findFirst({
        where: { clinicId: clinic.id, code: "CENTRO" },
      })) ??
      (await prisma.unit.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          name: "Unidade Centro",
          code: "CENTRO",
          address: "Av. Paulista, 1000 - São Paulo/SP",
        },
      }));

    for (const [code, name] of Object.entries(PERMISSION_LABELS)) {
      await prisma.permission.upsert({
        where: { code },
        create: { code, name },
        update: { name },
      });
    }

    const permissions = await prisma.permission.findMany();
    const permissionByCode = Object.fromEntries(
      permissions.map((p) => [p.code, p.id]),
    );

    const roleDefs = [
      { code: "ADMIN", name: "Administrador geral" },
      { code: "MANAGER", name: "Gestor da clínica" },
      { code: "RECEPTION", name: "Recepção" },
      { code: "FINANCE", name: "Financeiro" },
    ] as const;

    const roles: Record<string, string> = {};
    for (const role of roleDefs) {
      const found = await prisma.role.findFirst({
        where: { organizationId: org.id, clinicId: clinic.id, code: role.code },
      });
      if (found) {
        roles[role.code] = found.id;
        continue;
      }
      const created = await prisma.role.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          code: role.code,
          name: role.name,
          isSystem: true,
          permissions: {
            create: (ROLE_PERMISSIONS[role.code] ?? []).map(
              (code: PermissionCode) => ({
                permissionId: permissionByCode[code]!,
              }),
            ),
          },
        },
      });
      roles[role.code] = created.id;
    }

    const passwordHash = await hashPassword("Admin@123");

    let platformRole = await prisma.role.findFirst({
      where: { code: "PLATFORM_ADMIN", organizationId: null, clinicId: null },
    });
    if (!platformRole) {
      platformRole = await prisma.role.create({
        data: {
          organizationId: null,
          clinicId: null,
          code: "PLATFORM_ADMIN",
          name: "Administrador da plataforma",
          isSystem: true,
        },
      });
    }

    const platformUser = await prisma.user.findFirst({
      where: { email: "admin@plataforma.local" },
    });
    if (!platformUser) {
      await prisma.user.create({
        data: {
          organizationId: null,
          clinicId: null,
          roleId: platformRole.id,
          name: "Admin Plataforma",
          email: "admin@plataforma.local",
          passwordHash,
          status: "ACTIVE",
        },
      });
    }

    const staff = [
      {
        name: "Ana Administradora",
        email: "admin@dermaphios.com",
        roleId: roles.ADMIN!,
      },
      {
        name: "Marcos Gestor",
        email: "gestor@dermaphios.com",
        roleId: roles.MANAGER!,
      },
      {
        name: "Rita Recepção",
        email: "recepcao@dermaphios.com",
        roleId: roles.RECEPTION!,
      },
      {
        name: "Fábio Financeiro",
        email: "financeiro@dermaphios.com",
        roleId: roles.FINANCE!,
      },
    ];

    for (const user of staff) {
      const exists = await prisma.user.findFirst({
        where: { email: user.email, organizationId: org.id },
      });
      if (exists) continue;
      await prisma.user.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          unitId: unit.id,
          roleId: user.roleId,
          name: user.name,
          email: user.email,
          passwordHash,
          status: "ACTIVE",
        },
      });
    }

    return {
      ok: true as const,
      skipped: false,
      message: "Usuários staff criados.",
      login: {
        organizationSlug: ORG_SLUG,
        email: "admin@dermaphios.com",
        password: "Admin@123",
      },
    };
  });
}
