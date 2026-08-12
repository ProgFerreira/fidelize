import fs from "node:fs";
import path from "node:path";

const root = "prisma/migrations";
const folders = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const items = folders.map((name) => {
  const sql = fs.readFileSync(path.join(root, name, "migration.sql"), "utf8");
  return { name, sql };
});

const out =
  "/* Auto-gerado a partir de prisma/migrations — rode node scripts/embed-migrations.mjs */\n" +
  "export const EMBEDDED_MIGRATIONS: Array<{ name: string; sql: string }> = " +
  JSON.stringify(items, null, 2) +
  " as const;\n";

fs.mkdirSync("src/lib/setup", { recursive: true });
fs.writeFileSync("src/lib/setup/embedded-migrations.ts", out);
console.log(`embedded ${items.length} migrations (${out.length} chars)`);
