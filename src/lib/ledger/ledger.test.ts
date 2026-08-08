import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { creditWallet, redeemFromWallet, LedgerError } from "@/lib/ledger";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

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
  let organizationId = "";
  let walletId = "";
  let patientId = "";

  // `it()` do vitest roda numa cadeia assíncrona separada da do `beforeAll` —
  // o contexto do AsyncLocalStorage aberto lá não atravessa para cá. Por isso
  // cada teste precisa se envolver de novo em `comOrganizacao()`, e não dá
  // para confiar em um `entrarNaOrganizacao()` feito só no `beforeAll`.
  const teste = (nome: string, fn: () => Promise<void>) =>
    it(nome, () => comOrganizacao({ organizationId }, fn));

  beforeAll(async () => {
    // Descobrir QUAL clínica usar é bootstrap de teste, não operação de
    // negócio de uma organização específica — por isso roda sem escopo.
    const clinic = await semOrganizacao(() =>
      prisma.clinic.findFirst({ where: { active: true } }),
    );
    if (!clinic) throw new Error("Seed necessário antes dos testes de DB");
    if (!clinic.organizationId) {
      throw new Error(
        "Clínica de seed sem organizationId — rode o seed multi-tenant atual antes deste teste.",
      );
    }
    clinicId = clinic.id;
    organizationId = clinic.organizationId;

    await comOrganizacao({ organizationId }, async () => {
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
  });

  teste("impede dois resgates paralelos do mesmo saldo", async () => {
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
      // `redeemFromWallet` roda em isolamento Serializable com
      // `SELECT ... FOR UPDATE`. Sob disputa real pelo mesmo saldo, o MySQL
      // pode abortar a transação perdedora ANTES dela chegar na checagem de
      // saldo da aplicação — surge então como deadlock/conflito de escrita
      // vindo do driver (Prisma embrulha isso no código P2034), não como o
      // `LedgerError` amigável. Isso não é falha do teste: é a trava de
      // concorrência agindo numa camada mais baixa, e é uma garantia tão
      // válida quanto a checagem de saldo — por isso entra como desfecho
      // aceito, e não só um "escape" da asserção.
      const motivo = String(
        rejected[0].reason instanceof Error
          ? rejected[0].reason.message
          : rejected[0].reason,
      ).toLowerCase();

      expect(
        rejected[0].reason instanceof LedgerError ||
          motivo.includes("saldo") ||
          motivo.includes("serializ") ||
          motivo.includes("deadlock") ||
          motivo.includes("write conflict") ||
          motivo.includes("lock wait timeout") ||
          (rejected[0].reason as { code?: string })?.code === "P2034",
      ).toBe(true);
    }

    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    expect(Number(wallet?.availableBalance)).toBe(20);
  });

  teste("respeita idempotência de crédito", async () => {
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
