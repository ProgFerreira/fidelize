import { NextResponse } from "next/server";

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

  const ok = authSecret && databaseUrl;

  return NextResponse.json(
    {
      ok,
      node: process.version,
      checks: {
        AUTH_SECRET: authSecret,
        DATABASE_URL: databaseUrl,
        AUTH_URL: Boolean(authUrl),
        NEXT_PUBLIC_APP_URL: Boolean(appUrl),
      },
      hints: ok
        ? []
        : [
            !authSecret
              ? "Defina AUTH_SECRET no hPanel → Environment variables e salve (redeploy automático)."
              : null,
            !databaseUrl
              ? "Defina DATABASE_URL apontando para o MySQL da Hostinger."
              : null,
          ].filter(Boolean),
    },
    { status: ok ? 200 : 503 },
  );
}
