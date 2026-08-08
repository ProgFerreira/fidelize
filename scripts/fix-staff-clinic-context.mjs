import fs from "node:fs";
import path from "node:path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === "page.tsx") acc.push(p);
  }
  return acc;
}

const files = walk("src/app/(staff)");
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;

  s = s.replace(
    /const session = await requirePermission\(([^)]+)\);/g,
    "const { session, clinicId } = await requirePermission($1);",
  );
  s = s.replace(
    /const session = await requireSession\(\);/g,
    "const { session, clinicId } = await requireClinicContext();",
  );

  if (s.includes("requireClinicContext")) {
    s = s.replace(
      /import \{([^}]+)\} from "@\/lib\/auth\/guards";/,
      (m, inner) => {
        const parts = inner
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        const next = parts
          .map((p) => (p === "requireSession" ? "requireClinicContext" : p))
          .filter((p, i, a) => a.indexOf(p) === i);
        if (!next.includes("requireClinicContext")) {
          next.push("requireClinicContext");
        }
        return `import { ${next.join(", ")} } from "@/lib/auth/guards";`;
      },
    );
  }

  s = s.replace(/session\.user\.clinicId/g, "clinicId");

  if (s !== orig) {
    fs.writeFileSync(f, s);
    console.log("updated", f);
  }
}
