import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Hostinger grava env em arquivo protegido; `next start` / standalone
 * às vezes não injeta tudo em process.env. Carregamos .env* explicitamente.
 */
const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.production"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env.production.local"),
];

for (const file of candidates) {
  if (existsSync(file)) {
    loadEnv({ path: file, override: false });
  }
}
