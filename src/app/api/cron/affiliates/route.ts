import { NextResponse } from "next/server";
import { releaseDueCommissions } from "@/lib/affiliates";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await releaseDueCommissions({ limit: 500 });
  return NextResponse.json({
    ok: true,
    ...result,
    at: new Date().toISOString(),
  });
}
