import { describe, expect, it } from "vitest";
import {
  classifyWhatsAppReply,
  reminderSendAt,
  returnReminderOffsets,
} from "@/lib/whatsapp/reminders";

describe("lembretes WhatsApp", () => {
  it("agenda 24h antes quando a consulta é distante", () => {
    const startsAt = new Date("2026-08-20T15:00:00");
    const now = new Date("2026-08-18T10:00:00");
    const sendAt = reminderSendAt(startsAt, 24, now);
    expect(sendAt?.toISOString()).toBe(new Date("2026-08-19T15:00:00").toISOString());
  });

  it("envia na hora se a janela de 24h já passou mas a consulta é futura", () => {
    const startsAt = new Date("2026-08-14T16:00:00");
    const now = new Date("2026-08-14T10:00:00");
    const sendAt = reminderSendAt(startsAt, 24, now);
    expect(sendAt?.getTime()).toBe(now.getTime());
  });

  it("não envia se a consulta já passou", () => {
    const startsAt = new Date("2026-08-14T09:00:00");
    const now = new Date("2026-08-14T10:00:00");
    expect(reminderSendAt(startsAt, 2, now)).toBeNull();
  });

  it("só dispara retornos menores que o intervalo", () => {
    expect(returnReminderOffsets(120)).toEqual([30, 7, 1]);
    expect(returnReminderOffsets(14)).toEqual([7, 1]);
    expect(returnReminderOffsets(1)).toEqual([]);
  });

  it("classifica SIM, NÃO e saldo", () => {
    expect(classifyWhatsAppReply("SIM")).toBe("SIM");
    expect(classifyWhatsAppReply("não")).toBe("NAO");
    expect(classifyWhatsAppReply("nao")).toBe("NAO");
    expect(classifyWhatsAppReply("saldo")).toBe("SALDO");
    expect(classifyWhatsAppReply("oi")).toBeNull();
  });
});
