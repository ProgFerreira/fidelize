import { NextResponse } from "next/server";
import { getWidgetPatientSnapshot } from "@/lib/widget";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("x-api-key") || "";
  const patientId = url.searchParams.get("patientId") || undefined;
  const phone = url.searchParams.get("phone") || undefined;
  const origin = request.headers.get("origin");

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

  return NextResponse.json(
    { data },
    {
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    },
  );
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-api-key, content-type",
    },
  });
}
