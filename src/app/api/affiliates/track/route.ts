import { NextResponse } from "next/server";
import {
  AFFILIATE_COOKIE,
  trackAffiliateVisit,
} from "@/lib/affiliates";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const code = String(body.code || "").trim().toLowerCase();
  if (!code || code.length > 32) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const result = await trackAffiliateVisit({
    code,
    landingPath: body.landingPath ? String(body.landingPath) : null,
    referer: body.referer ? String(body.referer) : request.headers.get("referer"),
    utmSource: body.utmSource ? String(body.utmSource) : null,
    utmMedium: body.utmMedium ? String(body.utmMedium) : null,
    utmCampaign: body.utmCampaign ? String(body.utmCampaign) : null,
    visitToken: body.visitToken ? String(body.visitToken) : null,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const res = NextResponse.json({
    ok: true,
    visitToken: result.cookie.visitToken,
  });
  res.cookies.set(AFFILIATE_COOKIE, result.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: result.maxAgeSeconds,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
