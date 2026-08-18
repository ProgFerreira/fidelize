import type { VideoCallParticipantRole } from "@/generated/prisma/client";

/** Pura — sem I/O — pra dar pra testar sem carregar o resto do módulo (auth, prisma). */
export function formatChatTranscript(
  messages: Array<{
    fromRole: VideoCallParticipantRole;
    payload: unknown;
    createdAt: Date;
  }>,
): string {
  if (messages.length === 0) {
    return "Nenhuma mensagem de chat trocada nesta chamada.\n";
  }
  const linhas = messages.map((m) => {
    const hora = m.createdAt.toLocaleString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const quem = m.fromRole === "PROFISSIONAL" ? "Profissional" : "Paciente";
    const text =
      m.payload && typeof m.payload === "object" && "text" in m.payload
        ? String((m.payload as { text: unknown }).text)
        : "";
    return `[${hora}] ${quem}: ${text}`;
  });
  return linhas.join("\n") + "\n";
}
