import { NextResponse } from "next/server";
import {
  extractRequestOrigin,
  getWidgetPatientSnapshot,
} from "@/lib/widget";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Prefer header — query `key` é legado e não deve ser usado em novos embeds
  const key =
    request.headers.get("x-api-key") || url.searchParams.get("key") || "";
  const patientId = url.searchParams.get("patientId") || undefined;
  const phone = url.searchParams.get("phone") || undefined;
  const origin = extractRequestOrigin(request);

  if (!key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getWidgetPatientSnapshot({
    apiKey: key,
    patientId,
    phone,
    origin,
  });

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ("error" in data && data.error === "origin_not_allowed") {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const allowOrigin = origin && origin !== "null" ? origin : "";

  return NextResponse.json(
    { data },
    {
      headers: {
        ...(allowOrigin
          ? {
              "Access-Control-Allow-Origin": allowOrigin,
              Vary: "Origin",
            }
          : {}),
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "x-api-key, content-type",
      },
    },
  );
}

export async function OPTIONS(request: Request) {
  const origin = extractRequestOrigin(request) || "";
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key, content-type",
    },
  });
}
