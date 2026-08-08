import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { creditWallet, redeemFromWallet, LedgerError } from "@/lib/ledger";

const runDb = process.env.RUN_DB_TESTS === "1";

function makeCpf(seed: number) {
  const base = String(200000000 + seed).padStart(9, "0").slice(0, 9).split("").map(Number);
  let sum = base.reduce((a, d, i) => a + d * (10 - i), 0);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  const n = [...base, d1];
  sum = n.reduce((a, d, i) => a + d * (11 - i), 0);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return [...n, d2].join("");
}

describe.runIf(runDb)("ledger concurrency", () => {
  let clinicId = "";
  let walletId = "";
  let patientId = "";

  beforeAll(async () => {
    const clinic = await prisma.clinic.findFirst({ where: { active: true } });
    if (!clinic) throw new Error("Seed necessário antes dos testes de DB");
    clinicId = clinic.id;

    const category = await prisma.category.findFirst({
      where: { clinicId, slug: "bronze" },
    });

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        fullName: "Paciente Concorrencia Teste",
        cpf: makeCpf(Date.now() % 100000),
        phone: `1198${String(Date.now()).slice(-7)}`,
        regulationConsent: true,
        status: "ACTIVE",
      },
    });

    const wallet = await prisma.wallet.create({
      data: {
        clinicId,
        patientId: patient.id,
        categoryId: category?.id,
        status: "ACTIVE",
        availableBalance: 0,
        pendingBalance: 0,
        pointsBalance: 0,
      },
    });

    walletId = wallet.id;
    patientId = patient.id;

    await creditWallet({
      clinicId,
      walletId,
      patientId,
      amount: 100,
      idempotencyKey: `test-credit-base-${walletId}`,
    });
  });

  it("impede dois resgates paralelos do mesmo saldo", async () => {
    const keyBase = Date.now();
    const results = await Promise.allSettled([
      redeemFromWallet({
        clinicId,
        walletId,
        patientId,
        amount: 80,
        idempotencyKey: `parallel-a-${keyBase}`,
      }),
      redeemFromWallet({
        clinicId,
        walletId,
        patientId,
        amount: 80,
        idempotencyKey: `parallel-b-${keyBase}`,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0]?.status === "rejected") {
      expect(
        rejected[0].reason instanceof LedgerError ||
          String(rejected[0].reason).toLowerCase().includes("saldo") ||
          String(rejected[0].reason).toLowerCase().includes("serializ"),
      ).toBe(true);
    }

    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    expect(Number(wallet?.availableBalance)).toBe(20);
  });

  it("respeita idempotência de crédito", async () => {
    const key = `idem-credit-${Date.now()}`;
    const first = await creditWallet({
      clinicId,
      walletId,
      patientId,
      amount: 10,
      idempotencyKey: key,
    });
    const second = await creditWallet({
      clinicId,
      walletId,
      patientId,
      amount: 10,
      idempotencyKey: key,
    });
    expect(second.reused).toBe(true);
    expect(second.entry.id).toBe(first.entry.id);
  });
});
