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

for (const f of walk("src/app/(staff)")) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  s = s.replace(
    /const \{ session, clinicId \} = await requirePermission\(([^)]+)\);/g,
    "const session = await requirePermission($1);\n  const clinicId = session.clinicId;",
  );
  s = s.replace(
    /const \{ session, clinicId \} = await requireClinicContext\(\);/g,
    "const session = await requireClinicContext();\n  const clinicId = session.clinicId;",
  );
  if (s !== orig) {
    fs.writeFileSync(f, s);
    console.log("fixed", f);
  }
}
