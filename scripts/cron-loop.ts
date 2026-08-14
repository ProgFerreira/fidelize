/**
 * Loop local do cron (WAMP / Windows).
 * Uso: npm run cron
 */
import "dotenv/config";

const base =
  process.env.AUTH_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
const secret = process.env.CRON_SECRET || "";
const intervalMs = Number(process.env.CRON_INTERVAL_MS || 5 * 60 * 1000);

async function hit(path: string) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  const body = await res.text();
  console.log(new Date().toISOString(), path, res.status, body.slice(0, 300));
}

async function tick() {
  await hit("/api/cron/expire");
  await hit("/api/cron/v2");
  await hit("/api/cron/affiliates");
}

async function main() {
  if (!secret) {
    console.error("CRON_SECRET ausente no .env");
    process.exit(1);
  }
  console.log(`Cron FIDELIZE a cada ${Math.round(intervalMs / 1000)}s em ${base}`);
  await tick();
  setInterval(() => {
    void tick();
  }, intervalMs);
}

void main();
