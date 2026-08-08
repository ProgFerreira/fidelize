/**
 * Idempotent: adds organizationId to every Prisma model that has clinicId,
 * and injects Organization / PlatformAccess if missing.
 */
import fs from "node:fs";

const path = new URL("../prisma/schema.prisma", import.meta.url);
let s = fs.readFileSync(path, "utf8");

const orgBlock = `
model Organization {
  id               String    @id @default(cuid())
  slug             String    @unique
  name             String
  tradeName        String?
  document         String?   @unique
  plan             String    @default("trial")
  active           Boolean   @default(true)
  suspendedAt      DateTime?
  suspensionReason String?   @db.Text
  trialEndsAt      DateTime?
  maxUsers         Int?
  maxClinics       Int?
  maxPatients      Int?
  contactEmail     String?
  contactPhone     String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  clinics          Clinic[]
  users            User[]
  platformAccesses PlatformAccess[]

  @@index([active])
  @@index([deletedAt])
}

model PlatformAccess {
  id             String    @id @default(cuid())
  organizationId String
  userId         String
  reason         String    @db.Text
  ip             String?
  startedAt      DateTime  @default(now())
  endedAt        DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@index([organizationId, startedAt])
  @@index([userId])
}

`;

if (!s.includes("model Organization {")) {
  s = s.replace("model Clinic {", orgBlock + "model Clinic {");
}

// Clinic fields
if (!/model Clinic \{[\s\S]*?\n  organizationId /.test(s)) {
  s = s.replace(
    /model Clinic \{\r?\n  id\s+String\s+@id @default\(cuid\(\)\)\r?\n  name/,
    `model Clinic {
  id             String   @id @default(cuid())
  organizationId String
  slug           String?
  customDomain   String?
  name`,
  );
}

if (!/model Clinic \{[\s\S]*?organization\s+Organization/.test(s)) {
  s = s.replace(
    /(model Clinic \{[\s\S]*?)(\n  units\s+)/,
    `$1\n  organization         Organization @relation(fields: [organizationId], references: [id])$2`,
  );
}

if (!/model Clinic \{[\s\S]*?@@index\(\[organizationId\]\)/.test(s)) {
  s = s.replace(
    /(model Clinic \{[\s\S]*?)(\r?\n\})/,
    `$1
  @@unique([organizationId, slug])
  @@index([organizationId])
  @@index([organizationId, active])
  @@index([customDomain])$2`,
  );
}

// User: organizationId nullable (platform admin), clinicId optional
if (!/model User \{[\s\S]*?\n  organizationId /.test(s)) {
  s = s.replace(
    /model User \{\r?\n  id\s+String\s+@id @default\(cuid\(\)\)\r?\n  clinicId\s+String/,
    `model User {
  id             String     @id @default(cuid())
  organizationId String?
  clinicId       String?`,
  );
}

if (!/model User \{[\s\S]*?organization\s+Organization/.test(s)) {
  s = s.replace(
    /(model User \{[\s\S]*?)(\n  clinic\s+)/,
    `$1\n  organization  Organization?  @relation(fields: [organizationId], references: [id])$2`,
  );
}

if (!/model User \{[\s\S]*?platformAccesses/.test(s)) {
  s = s.replace(
    /(model User \{[\s\S]*?)(\n  @@unique)/,
    `$1\n  platformAccesses PlatformAccess[]$2`,
  );
}

// Fix User clinic relation to optional
s = s.replace(
  /clinic\s+Clinic\s+@relation\(fields: \[clinicId\], references: \[id\]\)/,
  "clinic        Clinic?        @relation(fields: [clinicId], references: [id])",
);

// User unique email per org
s = s.replace(
  /@@unique\(\[clinicId, email\]\)/,
  "@@unique([organizationId, email])",
);

if (!/model User \{[\s\S]*?@@index\(\[organizationId/.test(s)) {
  s = s.replace(
    /(model User \{[\s\S]*?@@unique\(\[organizationId, email\]\))/,
    `$1\n  @@index([organizationId, status])`,
  );
}

// For every model block that has clinicId but not organizationId, inject field
const modelRe = /model (\w+) \{([\s\S]*?)\n\}/g;
let out = "";
let last = 0;
let m;
while ((m = modelRe.exec(s)) !== null) {
  out += s.slice(last, m.index);
  const name = m[1];
  let body = m[2];
  last = m.index + m[0].length;

  if (
    name === "Organization" ||
    name === "PlatformAccess" ||
    name === "Permission" ||
    name === "RolePermission" ||
    name === "Account" ||
    name === "Session" ||
    name === "VerificationToken"
  ) {
    out += `model ${name} {${body}\n}`;
    continue;
  }

  const hasClinic = /\n  clinicId\s+/.test(body) || (name === "Clinic" && /\n  organizationId\s+/.test(body));
  const hasOrg = /\n  organizationId\s+/.test(body);

  if (name !== "Clinic" && name !== "User" && /\n  clinicId\s+/.test(body) && !hasOrg) {
    // After id line, insert organizationId as optional (extension fills it)
    body = body.replace(
      /(\n  id\s+[^\n]+\n)/,
      `$1  organizationId String?\n`,
    );
    if (!/@@index\(\[organizationId\]\)/.test(body)) {
      body += `\n  @@index([organizationId])`;
    }
  }

  out += `model ${name} {${body}\n}`;
}
out += s.slice(last);

fs.writeFileSync(path, out);
console.log("schema updated");
