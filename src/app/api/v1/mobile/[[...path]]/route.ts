import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestPatientOtp, verifyPatientOtp } from "@/lib/otp";
import { verifyApiKey, logIntegration } from "@/lib/integrations";
import { registerPushDevice } from "@/lib/push";
import { submitReceipt } from "@/lib/receipts";
import { describeMobileWhiteLabel } from "@/lib/mobile/contract";
import { createHash } from "crypto";

async function auth(request: Request) {
  const key = request.headers.get("x-api-key") || "";
  if (!key) return null;
  return verifyApiKey(key);
}

export async function GET() {
  return NextResponse.json({ data: describeMobileWhiteLabel() });
}

export async function POST(request: Request) {
  const started = Date.now();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const body = await request.json().catch(() => ({}));

  // Contract discovery already via GET; route by suffix
  if (path.endsWith("/otp/request")) {
    const cred = await auth(request);
    if (!cred || cred.rateLimited) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const phone = String(body.phone || "");
    const result = await requestPatientOtp({ clinicId: cred.clinicId, phone });
    await logIntegration({
      clinicId: cred.clinicId,
      direction: "IN",
      method: "POST",
      path: "/api/v1/mobile/otp/request",
      statusCode: 200,
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ data: { sent: true, patientId: result.patientId } });
  }

  if (path.endsWith("/otp/verify")) {
    const cred = await auth(request);
    if (!cred || cred.rateLimited) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const patient = await verifyPatientOtp({
      clinicId: cred.clinicId,
      phone: String(body.phone || ""),
      code: String(body.code || ""),
    });
    const sessionToken = createHash("sha256")
      .update(`${patient.id}:${Date.now()}:${process.env.AUTH_SECRET}`)
      .digest("hex");
    return NextResponse.json({
      data: {
        sessionToken,
        patientId: patient.id,
        clinicId: cred.clinicId,
        fullName: patient.fullName,
      },
    });
  }

  if (path.endsWith("/push/register")) {
    const cred = await auth(request);
    if (!cred || cred.rateLimited) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const device = await registerPushDevice({
      clinicId: cred.clinicId,
      data: {
        patientId: String(body.patientId || ""),
        token: String(body.token || ""),
        platform: body.platform as "ios" | "android" | "web",
        appId: body.appId ?? null,
      },
    });
    return NextResponse.json({ data: { id: device.id } });
  }

  if (path.endsWith("/home")) {
    const cred = await auth(request);
    if (!cred || cred.rateLimited) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const patientId = String(body.patientId || url.searchParams.get("patientId") || "");
    const wallet = await prisma.wallet.findFirst({
      where: { clinicId: cred.clinicId, patientId },
      include: { category: true },
    });
    return NextResponse.json({
      data: {
        balance: wallet?.availableBalance ?? "0",
        points: wallet?.pointsBalance ?? 0,
        category: wallet?.category?.name ?? null,
      },
    });
  }

  if (path.endsWith("/receipts")) {
    const cred = await auth(request);
    if (!cred || cred.rateLimited) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const receipt = await submitReceipt({
      clinicId: cred.clinicId,
      data: {
        patientId: String(body.patientId || ""),
        imageUrl: body.imageUrl ?? null,
        imageBase64: body.imageBase64 ?? null,
        declaredAmount: body.declaredAmount ?? null,
        merchantName: body.merchantName ?? null,
        idempotencyKey: body.idempotencyKey ?? `mobile-receipt:${Date.now()}`,
      },
    });
    return NextResponse.json({ data: receipt });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
