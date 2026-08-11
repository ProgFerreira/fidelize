import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getEnvSearchRoots,
  getLoadedEnvFiles,
} from "@/lib/load-env";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de deploy (sem expor valores secretos).
 * Abra: /api/health
 */
export async function GET() {
  const authSecret = Boolean(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  );
  const databaseUrl = Boolean(process.env.DATABASE_URL);
  const authUrl = process.env.AUTH_URL || null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || null;

  const searchRoots = getEnvSearchRoots();
  const envFiles = searchRoots.flatMap((root) =>
    [".env", ".env.production", ".env.local"].map((name) => {
      const path = resolve(root, name);
      return { path, exists: existsSync(path) };
    }),
  );

  const interestingKeys = Object.keys(process.env)
    .filter((k) =>
      /^(AUTH_|DATABASE_|NEXT_PUBLIC_|MYSQL_|DB_|NEXTAUTH_)/i.test(k),
    )
    .sort();

  const ok = authSecret && databaseUrl;
  const domainRootHint = searchRoots.find((r) =>
    /\/domains\/[^/]+\.hostingersite\.com$/.test(r),
  );

  return NextResponse.json(
    {
      ok,
      node: process.version,
      cwd: process.cwd(),
      checks: {
        AUTH_SECRET: authSecret,
        DATABASE_URL: databaseUrl,
        AUTH_URL: Boolean(authUrl),
        NEXT_PUBLIC_APP_URL: Boolean(appUrl),
      },
      loadedEnvFiles: getLoadedEnvFiles(),
      envFilesExisting: envFiles.filter((f) => f.exists),
      domainRootHint: domainRootHint ?? null,
      interestingKeys,
      hints: ok
        ? []
        : [
            "No File Manager, crie o arquivo .env na pasta do domínio (não dentro de hbuilds/versions).",
            domainRootHint
              ? `Caminho sugerido: ${domainRootHint}/.env`
              : "Caminho tipico: domains/aqua-owl-999948.hostingersite.com/.env",
            "Cole o conteúdo do hostinger.env, salve, reinicie o app Node.js e recarregue /api/health.",
            "Ou use hPanel → Environment variables → Import .env → Save (redeploy).",
          ],
    },
    { status: ok ? 200 : 503 },
  );
}
