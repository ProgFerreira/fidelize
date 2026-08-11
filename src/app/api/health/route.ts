import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import "@/lib/load-env";

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

  const envFiles = [".env", ".env.production", ".env.local"].map((name) => ({
    name,
    exists: existsSync(resolve(process.cwd(), name)),
  }));

  const interestingKeys = Object.keys(process.env)
    .filter((k) =>
      /^(AUTH_|DATABASE_|NEXT_PUBLIC_|MYSQL_|DB_|NEXTAUTH_)/i.test(k),
    )
    .sort();

  const ok = authSecret && databaseUrl;

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
      envFiles,
      interestingKeys,
      hints: ok
        ? []
        : [
            !authSecret
              ? "Defina AUTH_SECRET no hPanel → Environment variables e salve (redeploy automático)."
              : null,
            !databaseUrl
              ? "Defina DATABASE_URL apontando para o MySQL da Hostinger."
              : null,
            "Se interestingKeys estiver vazio, as variáveis não foram salvas no painel deste site.",
          ].filter(Boolean),
    },
    { status: ok ? 200 : 503 },
  );
}
