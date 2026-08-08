/**
 * Gera migration SQL multitenant a partir do schema.prisma atual.
 */
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const models = [];
const re = /model (\w+) \{([\s\S]*?)\n\}/g;
let m;
while ((m = re.exec(schema))) {
  const name = m[1];
  const body = m[2];
  if (!/\n  organizationId\s+/.test(body)) continue;
  if (name === "Organization" || name === "PlatformAccess") continue;
  const optional = /\n  organizationId String\?/.test(body);
  models.push({ name, optional: name === "User" || name === "AuditLog" || optional });
}

// User and AuditLog intentionally allow null; others get CHECK NOT NULL after backfill
const allowNull = new Set(["User", "AuditLog", "IntegrationLog"]);

const dir = new URL(
  "../prisma/migrations/20260807180000_multitenant_organization/",
  import.meta.url,
);
fs.mkdirSync(dir, { recursive: true });

const lines = [];
lines.push(`-- Multi-tenant: Organization as SaaS tenant root (Organization → Clinic → Unit)
-- Hand-written to preserve existing data (no drop/recreate).
`);

lines.push(`-- 1. Platform tables
CREATE TABLE IF NOT EXISTS \`Organization\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`slug\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`tradeName\` VARCHAR(191) NULL,
  \`document\` VARCHAR(191) NULL,
  \`plan\` VARCHAR(191) NOT NULL DEFAULT 'trial',
  \`active\` BOOLEAN NOT NULL DEFAULT true,
  \`suspendedAt\` DATETIME(3) NULL,
  \`suspensionReason\` TEXT NULL,
  \`trialEndsAt\` DATETIME(3) NULL,
  \`maxUsers\` INTEGER NULL,
  \`maxClinics\` INTEGER NULL,
  \`maxPatients\` INTEGER NULL,
  \`contactEmail\` VARCHAR(191) NULL,
  \`contactPhone\` VARCHAR(191) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  \`deletedAt\` DATETIME(3) NULL,
  UNIQUE INDEX \`Organization_slug_key\`(\`slug\`),
  UNIQUE INDEX \`Organization_document_key\`(\`document\`),
  INDEX \`Organization_active_idx\`(\`active\`),
  INDEX \`Organization_deletedAt_idx\`(\`deletedAt\`),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`PlatformAccess\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`organizationId\` VARCHAR(191) NOT NULL,
  \`userId\` VARCHAR(191) NOT NULL,
  \`reason\` TEXT NOT NULL,
  \`ip\` VARCHAR(191) NULL,
  \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`endedAt\` DATETIME(3) NULL,
  INDEX \`PlatformAccess_organizationId_startedAt_idx\`(\`organizationId\`, \`startedAt\`),
  INDEX \`PlatformAccess_userId_idx\`(\`userId\`),
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`);

lines.push(`-- 2. Default org from first clinic (or placeholder)
INSERT INTO \`Organization\` (
  \`id\`, \`slug\`, \`name\`, \`tradeName\`, \`document\`, \`plan\`, \`active\`, \`createdAt\`, \`updatedAt\`
)
SELECT
  'org_inicial_dermaphios_000',
  'dermaphios',
  COALESCE((SELECT \`name\` FROM \`Clinic\` ORDER BY \`createdAt\` LIMIT 1), 'Dermaphios'),
  (SELECT \`tradeName\` FROM \`Clinic\` ORDER BY \`createdAt\` LIMIT 1),
  (SELECT \`document\` FROM \`Clinic\` ORDER BY \`createdAt\` LIMIT 1),
  'profissional',
  true,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM \`Organization\` WHERE \`slug\` = 'dermaphios');

INSERT INTO \`Organization\` (
  \`id\`, \`slug\`, \`name\`, \`plan\`, \`active\`, \`createdAt\`, \`updatedAt\`
)
SELECT
  'org_plataforma_interno_000',
  '_plataforma',
  'Plataforma Fidelize',
  'enterprise',
  true,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM \`Organization\` WHERE \`slug\` = '_plataforma');
`);

lines.push(`-- 3. Add columns`);
for (const { name } of models) {
  lines.push(`ALTER TABLE \`${name}\` ADD COLUMN \`organizationId\` VARCHAR(191) NULL;`);
  lines.push(`CREATE INDEX \`${name}_organizationId_idx\` ON \`${name}\`(\`organizationId\`);`);
}

// Clinic also needs slug + customDomain
lines.push(`
ALTER TABLE \`Clinic\` ADD COLUMN \`slug\` VARCHAR(191) NULL;
ALTER TABLE \`Clinic\` ADD COLUMN \`customDomain\` VARCHAR(191) NULL;
CREATE INDEX \`Clinic_customDomain_idx\` ON \`Clinic\`(\`customDomain\`);
`);

lines.push(`-- 4. Backfill
UPDATE \`Clinic\` SET \`organizationId\` = 'org_inicial_dermaphios_000', \`slug\` = 'dermaphios' WHERE \`organizationId\` IS NULL;
`);

for (const { name } of models) {
  if (name === "Clinic") continue;
  if (name === "User") {
    lines.push(`UPDATE \`User\` u
  INNER JOIN \`Clinic\` c ON c.\`id\` = u.\`clinicId\`
  SET u.\`organizationId\` = c.\`organizationId\`
  WHERE u.\`organizationId\` IS NULL AND u.\`clinicId\` IS NOT NULL;`);
    continue;
  }
  if (name === "AuditLog") {
    lines.push(`UPDATE \`AuditLog\` a
  LEFT JOIN \`Clinic\` c ON c.\`id\` = a.\`clinicId\`
  SET a.\`organizationId\` = COALESCE(c.\`organizationId\`, 'org_inicial_dermaphios_000')
  WHERE a.\`organizationId\` IS NULL;`);
    continue;
  }
  // Prefer join via clinicId when present
  lines.push(`UPDATE \`${name}\` t
  INNER JOIN \`Clinic\` c ON c.\`id\` = t.\`clinicId\`
  SET t.\`organizationId\` = c.\`organizationId\`
  WHERE t.\`organizationId\` IS NULL;`);
  lines.push(`UPDATE \`${name}\` SET \`organizationId\` = 'org_inicial_dermaphios_000' WHERE \`organizationId\` IS NULL;`);
}

lines.push(`
-- 5. Clinic unique slug per org
CREATE UNIQUE INDEX \`Clinic_organizationId_slug_key\` ON \`Clinic\`(\`organizationId\`, \`slug\`);
`);

// User unique was clinicId+email — drop and recreate if needed
lines.push(`
-- User email unique per organization
DROP INDEX \`User_clinicId_email_key\` ON \`User\`;
CREATE UNIQUE INDEX \`User_organizationId_email_key\` ON \`User\`(\`organizationId\`, \`email\`);
`);

lines.push(`-- 6. Foreign keys`);
lines.push(`ALTER TABLE \`Clinic\` ADD CONSTRAINT \`Clinic_organizationId_fkey\` FOREIGN KEY (\`organizationId\`) REFERENCES \`Organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;`);
lines.push(`ALTER TABLE \`User\` ADD CONSTRAINT \`User_organizationId_fkey\` FOREIGN KEY (\`organizationId\`) REFERENCES \`Organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;`);
lines.push(`ALTER TABLE \`PlatformAccess\` ADD CONSTRAINT \`PlatformAccess_organizationId_fkey\` FOREIGN KEY (\`organizationId\`) REFERENCES \`Organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;`);
lines.push(`ALTER TABLE \`PlatformAccess\` ADD CONSTRAINT \`PlatformAccess_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;`);

for (const { name } of models) {
  if (name === "Clinic" || name === "User") continue;
  lines.push(
    `ALTER TABLE \`${name}\` ADD CONSTRAINT \`${name}_organizationId_fkey\` FOREIGN KEY (\`organizationId\`) REFERENCES \`Organization\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;`,
  );
}

lines.push(`-- 7. CHECK constraints (organizationId required except allow-null models)`);
for (const { name } of models) {
  if (allowNull.has(name)) continue;
  lines.push(
    `ALTER TABLE \`${name}\` ADD CONSTRAINT \`${name}_organizationId_required\` CHECK (\`organizationId\` IS NOT NULL);`,
  );
}

fs.writeFileSync(new URL("./migration.sql", dir), lines.join("\n") + "\n");
console.log(`Wrote migration with ${models.length} models`);
console.log(models.map((x) => x.name).join(", "));
