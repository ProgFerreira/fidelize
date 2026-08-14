import { NextResponse } from "next/server";
import { releaseDueCommissions } from "@/lib/affiliates";
import { assertCronAuthorized } from "@/lib/security/secrets";

export async function POST(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await releaseDueCommissions({ limit: 500 });
  return NextResponse.json({
    ok: true,
    ...result,
    at: new Date().toISOString(),
  });
}
