import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  applyGiftCardToSimulation,
  assertCampaignAvailable,
  campaignIsAvailableForPatient,
  type SimulationResult,
} from "./index";

function dbCampanha(counts: { total: number; porPaciente: number }) {
  return {
    campaignUse: {
      count: async ({
        where,
      }: {
        where: { campaignId: string; patientId?: string };
      }) => (where.patientId ? counts.porPaciente : counts.total),
    },
  } as Parameters<typeof assertCampaignAvailable>[0];
}

const campanhaAtiva = {
  id: "camp-1",
  status: "ACTIVE",
  startsAt: null as Date | null,
  endsAt: null as Date | null,
  totalLimit: 10,
  perPatientLimit: 1,
};

function simulacao(
  overrides: Partial<SimulationResult> = {},
): SimulationResult {
  return {
    grossAmount: "200.0000",
    discountAmount: "0.0000",
    benefitUsed: "0.0000",
    paidAmount: "200.0000",
    cashbackPercent: "10.0000",
    cashbackAmount: "20.0000",
    points: 200,
    periodCashbackUsed: "0.0000",
    settings: {
      ...DEFAULT_SETTINGS,
      maxCashbackPerTransaction: null,
      maxCashbackPerPatientPeriod: 8,
      pointsPerReal: 1,
    },
    ...overrides,
  };
}

describe("limites de campanha", () => {
  it("libera campanha dentro do teto total e por paciente", async () => {
    await expect(
      assertCampaignAvailable(
        dbCampanha({ total: 3, porPaciente: 0 }),
        campanhaAtiva,
        "pac-1",
      ),
    ).resolves.toBeUndefined();
    await expect(
      campaignIsAvailableForPatient(
        dbCampanha({ total: 3, porPaciente: 0 }),
        campanhaAtiva,
        "pac-1",
      ),
    ).resolves.toBe(true);
  });

  it("bloqueia quando o limite total foi atingido", async () => {
    await expect(
      assertCampaignAvailable(
        dbCampanha({ total: 10, porPaciente: 0 }),
        campanhaAtiva,
        "pac-1",
      ),
    ).rejects.toThrow(/Limite da campanha atingido/);
  });

  it("bloqueia quando o paciente já usou a cota", async () => {
    await expect(
      assertCampaignAvailable(
        dbCampanha({ total: 2, porPaciente: 1 }),
        campanhaAtiva,
        "pac-1",
      ),
    ).rejects.toThrow(/Limite da campanha para este paciente/);
  });

  it("rejeita campanha inativa, futura ou encerrada", async () => {
    const db = dbCampanha({ total: 0, porPaciente: 0 });
    await expect(
      assertCampaignAvailable(db, { ...campanhaAtiva, status: "DRAFT" }, "pac-1"),
    ).rejects.toThrow(/inativa/);

    const amanha = new Date();
    amanha.setUTCDate(amanha.getUTCDate() + 2);
    await expect(
      assertCampaignAvailable(
        db,
        { ...campanhaAtiva, startsAt: amanha },
        "pac-1",
      ),
    ).rejects.toThrow(/ainda não começou/);

    const ontem = new Date();
    ontem.setUTCDate(ontem.getUTCDate() - 2);
    await expect(
      assertCampaignAvailable(db, { ...campanhaAtiva, endsAt: ontem }, "pac-1"),
    ).rejects.toThrow(/encerrada/);

    await expect(
      campaignIsAvailableForPatient(
        db,
        { ...campanhaAtiva, status: "DRAFT" },
        "pac-1",
      ),
    ).resolves.toBe(false);
  });
});

describe("teto de cashback no período", () => {
  it("corta o cashback no restante do período", () => {
    const result = applyGiftCardToSimulation(simulacao(), 0);
    expect(result.cashbackAmount).toBe("8.0000");
  });

  it("zera cashback quando o teto do período já foi gasto", () => {
    const result = applyGiftCardToSimulation(
      simulacao({ periodCashbackUsed: "8.0000" }),
      0,
    );
    expect(result.cashbackAmount).toBe("0.0000");
  });

  it("não aplica teto de período quando a clínica não configurou", () => {
    const result = applyGiftCardToSimulation(
      simulacao({
        settings: {
          ...DEFAULT_SETTINGS,
          maxCashbackPerPatientPeriod: null,
          maxCashbackPerTransaction: null,
        },
      }),
      0,
    );
    expect(result.cashbackAmount).toBe("20.0000");
  });

  it("recalcula cashback só sobre o caixa após vale e ainda respeita o teto", () => {
    const result = applyGiftCardToSimulation(simulacao(), 150, "GPABC");
    expect(result.paidAmount).toBe("50.0000");
    expect(result.giftCardAmount).toBe("150.0000");
    expect(result.giftCardCode).toBe("GPABC");
    expect(result.cashbackAmount).toBe("5.0000");
    expect(result.points).toBe(50);
  });
});
