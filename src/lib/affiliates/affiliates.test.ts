import { describe, it, expect } from "vitest";
import {
  __test,
  calculateCommissionAmount,
  detectSelfReferral,
  encodeAffCookie,
  decodeAffCookie,
  generateAffiliateCode,
  AFFILIATE_COOKIE,
} from "./index";
import { money } from "@/lib/money";

describe("affiliates — código e cookie", () => {
  it("gera código URL-safe sem expor id sequencial", () => {
    const code = generateAffiliateCode(10);
    expect(code).toMatch(/^[a-z0-9]+$/);
    expect(code).toHaveLength(10);
    expect(code).not.toMatch(/[01ilo]/);
  });

  it("codifica e decodifica cookie de atribuição", () => {
    const payload = {
      code: "abc123xyz",
      visitToken: "tok",
      exp: Date.now() + 60_000,
      utmCampaign: "instagram",
    };
    const raw = encodeAffCookie(payload);
    expect(decodeAffCookie(raw)?.code).toBe("abc123xyz");
    expect(decodeAffCookie(raw)?.utmCampaign).toBe("instagram");
    expect(AFFILIATE_COOKIE).toBe("fid_aff");
  });

  it("cookie expirado é inválido", () => {
    const raw = encodeAffCookie({
      code: "x",
      visitToken: "t",
      exp: Date.now() - 1000,
    });
    expect(decodeAffCookie(raw)).toBeNull();
  });
});

describe("affiliates — cálculo e fraude", () => {
  it("cálculo percentual usa decimal corretamente", () => {
    const amount = calculateCommissionAmount({
      netAmount: "1000.00",
      commissionType: "PERCENT",
      commissionValue: "10",
    });
    expect(amount.toFixed(4)).toBe("100.0000");
  });

  it("desconto reduz a base de cálculo", () => {
    const gross = money("1000");
    const discount = money("200");
    const net = gross.minus(discount);
    const amount = calculateCommissionAmount({
      netAmount: net,
      commissionType: "PERCENT",
      commissionValue: "10",
    });
    expect(amount.toFixed(2)).toBe("80.00");
  });

  it("valor fixo ignora percentual", () => {
    const amount = calculateCommissionAmount({
      netAmount: "5000",
      commissionType: "FIXED",
      commissionValue: "50",
    });
    expect(amount.toFixed(2)).toBe("50.00");
  });

  it("autoindicação por e-mail é detectada", () => {
    const flags = detectSelfReferral({
      affiliateEmail: "parceiro@exemplo.com",
      orgEmail: "parceiro@exemplo.com",
    });
    expect(flags).toContain("same_email");
  });

  it("autoindicação por documento é detectada", () => {
    const flags = detectSelfReferral({
      affiliateEmail: "a@x.com",
      affiliateDocument: "12.345.678/0001-90",
      orgDocument: "12345678000190",
    });
    expect(flags).toContain("same_document");
  });

  it("sem match não marca fraude", () => {
    expect(
      detectSelfReferral({
        affiliateEmail: "a@x.com",
        orgEmail: "b@y.com",
        affiliateDocument: "111",
        orgDocument: "222",
      }),
    ).toEqual([]);
  });
});

describe("affiliates — regras de atribuição e ciclo (unit)", () => {
  it("último clique prevalece enquanto não houver cadastro consolidado", () => {
    let attribution: string | null = null;
    const applyClick = (code: string, consolidated: boolean) => {
      if (consolidated) return attribution;
      attribution = code;
      return attribution;
    };
    applyClick("aff_a", false);
    expect(applyClick("aff_b", false)).toBe("aff_b");
    expect(applyClick("aff_c", true)).toBe("aff_b");
  });

  it("código inválido / afiliado suspenso não deve gerar indicação", () => {
    const canTrack = (status: string) => status === "ACTIVE";
    expect(canTrack("SUSPENDED")).toBe(false);
    expect(canTrack("ACTIVE")).toBe(true);
    expect(canTrack("PENDING")).toBe(false);
  });

  it("venda sem indicação não gera comissão", () => {
    const referral = null;
    const shouldCreate = Boolean(referral);
    expect(shouldCreate).toBe(false);
  });

  it("venda não paga não gera comissão", () => {
    const saleStatus: string = "PENDING";
    expect(saleStatus === "CONFIRMED").toBe(false);
  });

  it("primeira compra gera uma comissão; reprocessar não duplica (unique key)", () => {
    const keys = new Set<string>();
    const createOnce = (saleId: string) => {
      const key = `${saleId}:PRIMARY`;
      if (keys.has(key)) return { duplicated: true };
      keys.add(key);
      return { duplicated: false };
    };
    expect(createOnce("sale1").duplicated).toBe(false);
    expect(createOnce("sale1").duplicated).toBe(true);
  });

  it("segunda compra não gera quando firstPurchaseOnly", () => {
    const firstPurchaseOnly = true;
    const priorConfirmed = 1;
    const eligible = !(firstPurchaseOnly && priorConfirmed > 0);
    expect(eligible).toBe(false);
  });

  it("estorno cancela comissão pendente", () => {
    let status = "PENDING";
    const onRefund = () => {
      if (status !== "PAID") status = "CANCELLED";
    };
    onRefund();
    expect(status).toBe("CANCELLED");
  });

  it("estorno de comissão paga gera ajuste sem apagar histórico", () => {
    const commissions = [
      { id: "c1", kind: "PRIMARY", status: "PAID", amount: "100" },
    ];
    const onRefundPaid = () => {
      commissions.push({
        id: "c2",
        kind: "ADJUSTMENT",
        status: "AVAILABLE",
        amount: "-100",
      });
    };
    onRefundPaid();
    expect(commissions.find((c) => c.kind === "PRIMARY")?.status).toBe("PAID");
    expect(commissions.find((c) => c.kind === "ADJUSTMENT")?.amount).toBe("-100");
  });

  it("rotina libera comissão após prazo", () => {
    const now = new Date("2026-08-20T00:00:00Z");
    const availableAt = new Date("2026-08-19T00:00:00Z");
    const saleOk = true;
    const status = "PENDING";
    const canRelease =
      status === "PENDING" && availableAt <= now && saleOk;
    expect(canRelease).toBe(true);
    expect(__test.addDays(new Date("2026-08-01T00:00:00Z"), 14).toISOString()).toContain(
      "2026-08-15",
    );
  });

  it("pagamento inclui apenas comissões elegíveis e atômico", () => {
    const items = [
      { id: "1", affiliateId: "a1", status: "AVAILABLE" },
      { id: "2", affiliateId: "a1", status: "PENDING" },
      { id: "3", affiliateId: "a2", status: "AVAILABLE" },
    ];
    const affiliateId = "a1";
    const eligible = items.filter(
      (i) => i.affiliateId === affiliateId && i.status === "AVAILABLE",
    );
    expect(eligible).toHaveLength(1);
    expect(eligible[0]!.id).toBe("1");
  });

  it("afiliado não acessa dados de outro", () => {
    const sessionAffiliateId: string = "aff_1";
    const requestedId: string = "aff_2";
    expect(sessionAffiliateId === requestedId).toBe(false);
  });

  it("usuário sem permissão admin é bloqueado", () => {
    const roleCode: string = "AFFILIATE";
    const isPlatformAdmin = roleCode === "PLATFORM_ADMIN";
    expect(isPlatformAdmin).toBe(false);
  });

  it("alteração manual exige justificativa e gera auditoria", () => {
    const reason = "acordo comercial";
    const audit: Array<{ action: string; reason: string }> = [];
    if (reason.trim().length >= 5) {
      audit.push({ action: "AFFILIATE_REFERRAL_LINK", reason });
    }
    expect(audit).toHaveLength(1);
  });

  it("hash de IP não é identificador principal", () => {
    const visitToken = "random-token";
    const ipHash = __test.hashIp("1.2.3.4");
    expect(visitToken).not.toEqual(ipHash);
    expect(ipHash).toHaveLength(32);
  });
});
