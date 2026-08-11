import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Hostinger roda em `hbuilds/versions/<id>/nodejs` (efêmero).
 * Procuramos `.env*` subindo até a raiz do domínio para sobreviver a redeploys.
 */
function collectEnvCandidates(startDir: string): string[] {
  const names = [
    ".env",
    ".env.production",
    ".env.local",
    ".env.production.local",
  ];
  const dirs: string[] = [];
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    dirs.push(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const files: string[] = [];
  for (const d of dirs) {
    for (const name of names) {
      files.push(resolve(d, name));
    }
  }
  return files;
}

const loadedFrom: string[] = [];

for (const file of collectEnvCandidates(process.cwd())) {
  if (!existsSync(file)) continue;
  const result = loadEnv({ path: file, override: false });
  if (result.parsed && Object.keys(result.parsed).length > 0) {
    loadedFrom.push(file);
  }
}

export function getLoadedEnvFiles() {
  return loadedFrom;
}

export function getEnvSearchRoots() {
  const roots: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    roots.push(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return roots;
}
