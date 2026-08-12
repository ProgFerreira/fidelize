import { describe, expect, it } from "vitest";
import {
  parsePdvPaymentMethod,
  paymentMethodLabel,
  requirePdvPaymentMethod,
} from "./methods";
import { clinicDayBounds, clinicRangeBounds, parseYmd, resolveExtractPeriod } from "@/lib/datetime/clinic-day";

describe("formas de pagamento do PDV", () => {
  it("aceita só métodos conhecidos", () => {
    expect(parsePdvPaymentMethod("pix")).toBe("pix");
    expect(parsePdvPaymentMethod("DINHEIRO")).toBe("dinheiro");
    expect(parsePdvPaymentMethod("boleto")).toBeNull();
    expect(parsePdvPaymentMethod("")).toBeNull();
  });

  it("rotula vale-presente e métodos do caixa", () => {
    expect(paymentMethodLabel("gift_card")).toBe("Vale-presente");
    expect(paymentMethodLabel("credito")).toBe("Cartão crédito");
    expect(paymentMethodLabel(null)).toBe("Não informado");
  });

  it("exige forma ao fechar venda com valor", () => {
    expect(() => requirePdvPaymentMethod("")).toThrow(/forma de pagamento/);
    expect(requirePdvPaymentMethod("debito")).toBe("debito");
  });
});

describe("dia civil da clínica", () => {
  it("rejeita data inválida", () => {
    expect(parseYmd("12/08/2026")).toBeNull();
    expect(parseYmd("2026-08-12")).toBe("2026-08-12");
  });

  it("início do dia em São Paulo é UTC-3", () => {
    const { start, end } = clinicDayBounds("2026-08-12", "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-08-12T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-13T02:59:59.999Z");
  });

  it("intervalo cobre do início de X ao fim de Y", () => {
    const range = clinicRangeBounds(
      "2026-08-12",
      "2026-08-14",
      "America/Sao_Paulo",
    );
    expect(range.fromYmd).toBe("2026-08-12");
    expect(range.toYmd).toBe("2026-08-14");
    expect(range.start.toISOString()).toBe("2026-08-12T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-15T02:59:59.999Z");
  });

  it("resolve período a partir de de/até e inverte se necessário", () => {
    const period = resolveExtractPeriod({
      de: "2026-08-20",
      ate: "2026-08-12",
      todayYmd: "2026-08-12",
    });
    expect(period.fromYmd).toBe("2026-08-12");
    expect(period.toYmd).toBe("2026-08-20");
    expect(period.isRange).toBe(true);
  });

  it("mantém data única via parâmetro data", () => {
    const period = resolveExtractPeriod({
      data: "2026-08-12",
      todayYmd: "2026-08-20",
    });
    expect(period.fromYmd).toBe("2026-08-12");
    expect(period.toYmd).toBe("2026-08-12");
    expect(period.isRange).toBe(false);
  });
});
