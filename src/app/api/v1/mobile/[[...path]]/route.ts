import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestPatientOtp, verifyPatientOtp } from "@/lib/otp";
import { verifyApiKey, logIntegration } from "@/lib/integrations";
import { registerPushDevice } from "@/lib/push";
import { submitReceipt } from "@/lib/receipts";
import { describeMobileWhiteLabel } from "@/lib/mobile/contract";
import {
  createMobileSession,
  verifyMobileSession,
} from "@/lib/mobile/session";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

async function authClinic(request: Request) {
  const key = request.headers.get("x-api-key") || "";
  if (!key) return null;
  return semOrganizacao(() => verifyApiKey(key));
}

async function withClinicOrg<T>(
  clinicId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const clinic = await semOrganizacao(() =>
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { organizationId: true },
    }),
  );
  if (!clinic?.organizationId) throw new Error("Clínica sem organização");
  return comOrganizacao({ organizationId: clinic.organizationId }, fn);
}

async function requirePatientSession(
  request: Request,
  clinicId: string,
  bodyPatientId?: string,
) {
  const sessionToken =
    request.headers.get("x-session-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!sessionToken) return null;
  const session = await verifyMobileSession({ clinicId, sessionToken });
  if (!session) return null;
  if (bodyPatientId && bodyPatientId !== session.patientId) return null;
  return session;
}

export async function GET() {
  return NextResponse.json({ data: describeMobileWhiteLabel() });
}

export async function POST(request: Request) {
  const started = Date.now();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const body = await request.json().catch(() => ({}));

  try {
    if (path.endsWith("/otp/request")) {
      const cred = await authClinic(request);
      if (!cred || cred.rateLimited) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const phone = String(body.phone || "");
      await withClinicOrg(cred.clinicId, () =>
        requestPatientOtp({ clinicId: cred.clinicId, phone }),
      );
      await withClinicOrg(cred.clinicId, () =>
        logIntegration({
          clinicId: cred.clinicId,
          direction: "IN",
          method: "POST",
          path: "/api/v1/mobile/otp/request",
          statusCode: 200,
          durationMs: Date.now() - started,
        }),
      );
      return NextResponse.json({
        data: { sent: true },
      });
    }

    if (path.endsWith("/otp/verify")) {
      const cred = await authClinic(request);
      if (!cred || cred.rateLimited) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const patient = await withClinicOrg(cred.clinicId, () =>
        verifyPatientOtp({
          clinicId: cred.clinicId,
          phone: String(body.phone || ""),
          code: String(body.code || ""),
        }),
      );
      const session = await withClinicOrg(cred.clinicId, () =>
        createMobileSession({
          clinicId: cred.clinicId,
          patientId: patient.id,
        }),
      );
      return NextResponse.json({
        data: {
          sessionToken: session.sessionToken,
          expiresAt: session.expiresAt.toISOString(),
          patientId: patient.id,
          clinicId: cred.clinicId,
          fullName: patient.fullName,
        },
      });
    }

    if (path.endsWith("/push/register")) {
      const cred = await authClinic(request);
      if (!cred || cred.rateLimited) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const patientId = String(body.patientId || "");
      const session = await withClinicOrg(cred.clinicId, () =>
        requirePatientSession(request, cred.clinicId, patientId),
      );
      if (!session) {
        return NextResponse.json(
          { error: "Sessão do paciente inválida" },
          { status: 401 },
        );
      }
      const device = await withClinicOrg(cred.clinicId, () =>
        registerPushDevice({
          clinicId: cred.clinicId,
          data: {
            patientId: session.patientId,
            token: String(body.token || ""),
            platform: body.platform as "ios" | "android" | "web",
            appId: body.appId ?? null,
          },
        }),
      );
      return NextResponse.json({ data: { id: device.id } });
    }

    if (path.endsWith("/home")) {
      const cred = await authClinic(request);
      if (!cred || cred.rateLimited) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const patientId = String(
        body.patientId || url.searchParams.get("patientId") || "",
      );
      const session = await withClinicOrg(cred.clinicId, () =>
        requirePatientSession(request, cred.clinicId, patientId || undefined),
      );
      if (!session) {
        return NextResponse.json(
          { error: "Sessão do paciente inválida" },
          { status: 401 },
        );
      }
      const wallet = await withClinicOrg(cred.clinicId, () =>
        prisma.wallet.findFirst({
          where: {
            clinicId: cred.clinicId,
            patientId: session.patientId,
          },
          include: { category: true },
        }),
      );
      return NextResponse.json({
        data: {
          balance: wallet?.availableBalance ?? "0",
          points: wallet?.pointsBalance ?? 0,
          category: wallet?.category?.name ?? null,
          patientId: session.patientId,
        },
      });
    }

    if (path.endsWith("/receipts")) {
      const cred = await authClinic(request);
      if (!cred || cred.rateLimited) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const patientId = String(body.patientId || "");
      const session = await withClinicOrg(cred.clinicId, () =>
        requirePatientSession(request, cred.clinicId, patientId),
      );
      if (!session) {
        return NextResponse.json(
          { error: "Sessão do paciente inválida" },
          { status: 401 },
        );
      }
      const receipt = await withClinicOrg(cred.clinicId, () =>
        submitReceipt({
          clinicId: cred.clinicId,
          data: {
            patientId: session.patientId,
            imageUrl: body.imageUrl ?? null,
            imageBase64: body.imageBase64 ?? null,
            declaredAmount: body.declaredAmount ?? null,
            merchantName: body.merchantName ?? null,
            idempotencyKey:
              body.idempotencyKey ?? `mobile-receipt:${Date.now()}`,
          },
        }),
      );
      return NextResponse.json({ data: receipt });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro no endpoint mobile",
      },
      { status: 400 },
    );
  }
}
