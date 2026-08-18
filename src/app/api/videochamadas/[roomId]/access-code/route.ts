import { NextResponse } from "next/server";
import { identifyVideoCallCaller, getVideoCallRoom } from "@/lib/videocalls";
import { requestStaffOtpForPatient } from "@/lib/otp";

export const runtime = "nodejs";

/**
 * Gera um código de acesso pro paciente da sala, pro profissional repassar
 * manualmente (ex.: WhatsApp pessoal, via wa.me) — não depende de nenhuma
 * API paga configurada.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;

  const caller = await identifyVideoCallCaller();
  if (!caller || caller.role !== "PROFISSIONAL") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const room = await getVideoCallRoom(caller.clinicId, roomId);
  if (!room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  try {
    const result = await requestStaffOtpForPatient({
      clinicId: caller.clinicId,
      patientId: room.patientId,
      actorId: caller.userId,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar código";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
