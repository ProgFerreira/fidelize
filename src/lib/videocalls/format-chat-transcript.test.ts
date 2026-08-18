import { describe, expect, it } from "vitest";
import { formatChatTranscript } from "@/lib/videocalls/chat-transcript-format";

describe("formatChatTranscript", () => {
  it("retorna mensagem padrão quando não há mensagens", () => {
    expect(formatChatTranscript([])).toBe(
      "Nenhuma mensagem de chat trocada nesta chamada.\n",
    );
  });

  it("formata mensagens com hora, remetente e texto", () => {
    const result = formatChatTranscript([
      {
        fromRole: "PROFISSIONAL",
        payload: { text: "Olá, tudo bem?" },
        createdAt: new Date("2026-08-17T14:30:00Z"),
      },
      {
        fromRole: "PACIENTE",
        payload: { text: "Tudo sim, obrigado" },
        createdAt: new Date("2026-08-17T14:31:00Z"),
      },
    ]);

    const linhas = result.trim().split("\n");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain("Profissional: Olá, tudo bem?");
    expect(linhas[1]).toContain("Paciente: Tudo sim, obrigado");
  });

  it("ignora payload sem campo text", () => {
    const result = formatChatTranscript([
      { fromRole: "PACIENTE", payload: { foo: "bar" }, createdAt: new Date() },
    ]);
    expect(result).toContain("Paciente: ");
  });
});
