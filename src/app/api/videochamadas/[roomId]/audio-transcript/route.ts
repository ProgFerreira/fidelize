import { NextResponse } from "next/server";
import { z } from "zod";
import {
  identifyVideoCallCaller,
  getVideoCallRoom,
  saveAudioTranscript,
} from "@/lib/videocalls";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().min(1),
  durationSeconds: z.number().int().positive().optional(),
});

/**
 * Recebe o TEXTO já transcrito localmente no navegador de quem grava
 * (Whisper via WASM) — o áudio em si nunca é enviado. Só o profissional
 * pode salvar, e fica vinculado ao histórico do paciente.
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

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    const transcript = await saveAudioTranscript({
      clinicId: caller.clinicId,
      roomId,
      actorId: caller.userId,
      text: body.data.text,
      durationSeconds: body.data.durationSeconds,
    });

    return NextResponse.json({ data: transcript }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar transcrição";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
