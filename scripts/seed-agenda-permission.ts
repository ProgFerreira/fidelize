import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS } from "../src/lib/auth/permissions";

function createClient() {
  const url = process.env.DATABASE_URL!;
  const parsed = new URL(url);
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username || "root"),
      password: decodeURIComponent(parsed.password || ""),
      database: parsed.pathname.replace(/^\//, ""),
    }),
  });
}

async function main() {
  const prisma = createClient();
  const code = PERMISSIONS.AGENDA_MANAGE;
  const name = "Gerenciar agenda";

  const perm = await prisma.permission.upsert({
    where: { code },
    create: { code, name },
    update: { name },
  });

  const roles = await prisma.role.findMany({
    where: { code: { in: ["ADMIN", "MANAGER", "RECEPTION"] } },
    select: { id: true, code: true },
  });

  for (const role of roles) {
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: perm.id },
      },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log("linked", role.code);
  }

  console.log("ok", perm.id);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
