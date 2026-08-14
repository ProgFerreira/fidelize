import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de deploy (sem expor valores secretos nem caminhos).
 */
export async function GET() {
  const authSecret = Boolean(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  );
  const databaseUrl = Boolean(process.env.DATABASE_URL);
  const authUrl = Boolean(process.env.AUTH_URL);
  const appUrl = Boolean(process.env.NEXT_PUBLIC_APP_URL);
  const ok = authSecret && databaseUrl;

  return NextResponse.json(
    {
      ok,
      checks: {
        AUTH_SECRET: authSecret,
        DATABASE_URL: databaseUrl,
        AUTH_URL: authUrl,
        NEXT_PUBLIC_APP_URL: appUrl,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
