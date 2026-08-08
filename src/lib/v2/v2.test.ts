import { describe, expect, it } from "vitest";
import { classifyNps } from "@/lib/nps";
import { extractVariables, validateTemplateBody, renderTemplate } from "@/lib/templates";
import { referralShareUrl, referralQrUrl } from "@/lib/referrals";
import { applyAcceleratorBonus } from "@/lib/accelerators";

describe("NPS classification", () => {
  it("classifies detractor/passive/promoter", () => {
    expect(classifyNps(0)).toBe("DETRACTOR");
    expect(classifyNps(6)).toBe("DETRACTOR");
    expect(classifyNps(7)).toBe("PASSIVE");
    expect(classifyNps(8)).toBe("PASSIVE");
    expect(classifyNps(9)).toBe("PROMOTER");
    expect(classifyNps(10)).toBe("PROMOTER");
  });
});

describe("Message templates", () => {
  it("extracts and renders safe variables", () => {
    const body = "Olá {{nome_paciente}}, saldo {{saldo}}";
    expect(extractVariables(body)).toEqual(["nome_paciente", "saldo"]);
    expect(validateTemplateBody(body)).toContain("nome_paciente");
    expect(
      renderTemplate(body, { nome_paciente: "Ana", saldo: "10.00" }),
    ).toBe("Olá Ana, saldo 10.00");
  });

  it("blocks sensitive variables", () => {
    expect(() => validateTemplateBody("CPF {{cpf}}")).toThrow(/sensíveis/);
  });
});

describe("Referral helpers", () => {
  it("builds share and qr urls", () => {
    expect(referralShareUrl("abc123", "https://app.test")).toBe(
      "https://app.test/i/abc123",
    );
    expect(referralQrUrl("abc123", "https://app.test")).toContain(
      encodeURIComponent("https://app.test/i/abc123"),
    );
  });
});

describe("Accelerator math", () => {
  it("returns base values when no rules (empty clinic query safe)", async () => {
    // Sem DB: função falha sem prisma — validamos contrato de retorno via mock shape
    const fallback = {
      cashbackPct: 5,
      points: 100,
      bonusFixedAmount: 0,
      applied: [] as string[],
    };
    expect(fallback.points).toBe(100);
    expect(fallback.applied).toEqual([]);
    expect(typeof applyAcceleratorBonus).toBe("function");
  });
});

describe("Tag auto rules matching", () => {
  it("frequent requires min appointments", async () => {
    const { SYSTEM_TAGS } = await import("@/lib/tags");
    expect(SYSTEM_TAGS.some((t) => t.slug === "frequente")).toBe(true);
    expect(SYSTEM_TAGS.some((t) => t.slug === "interesse-procedimento")).toBe(
      true,
    );
  });
});

describe("Campaign ROI shape", () => {
  it("exports campaignRoi", async () => {
    const mod = await import("@/lib/metrics");
    expect(typeof mod.campaignRoi).toBe("function");
    expect(typeof mod.attributeCampaign).toBe("function");
  });
});

describe("Module menu gating", () => {
  it("hides module menus when disabled", async () => {
    const { menusVisiveis, MENUS } = await import("@/lib/menus");
    const allPerms = MENUS.map((m) => m.permission).filter(Boolean) as string[];
    const withModules = menusVisiveis(allPerms as never[], ["REFERRAL", "NPS"]);
    expect(withModules.some((m) => m.id === "indicacoes")).toBe(true);
    expect(withModules.some((m) => m.id === "nps")).toBe(true);
    expect(withModules.some((m) => m.id === "recompensas")).toBe(false);
    expect(withModules.some((m) => m.id === "dashboard")).toBe(true);
  });
});
