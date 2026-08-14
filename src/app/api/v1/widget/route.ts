import { NextResponse } from "next/server";
import {
  cabecalhosCorsWidget,
  extractRequestOrigin,
  getWidgetPatientSnapshot,
  origemCorsDoWidget,
} from "@/lib/widget";

export async function GET(request: Request) {
  const url = new URL(request.url);
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

  const allowOrigin = await origemCorsDoWidget(origin);
  return NextResponse.json(
    { data },
    { headers: cabecalhosCorsWidget(allowOrigin) },
  );
}

export async function OPTIONS(request: Request) {
  const origin = extractRequestOrigin(request);
  const allowOrigin = await origemCorsDoWidget(origin);
  if (!allowOrigin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: cabecalhosCorsWidget(allowOrigin),
  });
}
