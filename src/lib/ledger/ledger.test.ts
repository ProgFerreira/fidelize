import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { creditWallet, redeemFromWallet, reverseLedgerEntry, debitPointsInTx, LedgerError } from "@/lib/ledger";
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

  afterAll(async () => {
    if (!patientId || !organizationId) return;
    await comOrganizacao({ organizationId }, async () => {
      // Ordem de FK: RedemptionItem → Redemption → LedgerEntry → CreditLot → Card → Wallet → Patient
      const redemptions = await prisma.redemption.findMany({
        where: { walletId },
        select: { id: true },
      });
      const redemptionIds = redemptions.map((r) => r.id);
      if (redemptionIds.length) {
        await prisma.redemptionItem.deleteMany({
          where: { redemptionId: { in: redemptionIds } },
        });
        await prisma.redemption.deleteMany({ where: { id: { in: redemptionIds } } });
      }
      await prisma.ledgerEntry.deleteMany({ where: { patientId } });
      await prisma.creditLot.deleteMany({ where: { walletId } });
      await prisma.card.deleteMany({ where: { walletId } }).catch(() => undefined);
      await prisma.idempotencyKey
        .deleteMany({
          where: {
            OR: [
              { key: { startsWith: `test-credit-base-${walletId}` } },
              { key: { startsWith: `parallel-` } },
              { key: { startsWith: `idem-credit-` } },
            ],
          },
        })
        .catch(() => undefined);
      await prisma.wallet.deleteMany({ where: { patientId } });
      await prisma.patient.deleteMany({ where: { id: patientId } });
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

describe.runIf(runDb)("ledger pontos", () => {
  let clinicId = "";
  let organizationId = "";
  let walletId = "";
  let patientId = "";
  let operatorId = "";

  const teste = (nome: string, fn: () => Promise<void>) =>
    it(nome, () => comOrganizacao({ organizationId }, fn));

  beforeAll(async () => {
    const clinic = await semOrganizacao(() =>
      prisma.clinic.findFirst({ where: { active: true } }),
    );
    if (!clinic?.organizationId) {
      throw new Error("Seed necessário antes dos testes de DB");
    }
    clinicId = clinic.id;
    organizationId = clinic.organizationId;

    const admin = await semOrganizacao(() =>
      prisma.user.findFirst({
        where: { organizationId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      }),
    );
    if (!admin) throw new Error("Nenhum usuário ativo para operatorId");
    operatorId = admin.id;

    await comOrganizacao({ organizationId }, async () => {
      const patient = await prisma.patient.create({
        data: {
          clinicId,
          fullName: "Paciente Pontos Teste",
          cpf: makeCpf((Date.now() % 100000) + 1),
          phone: `1197${String(Date.now()).slice(-7)}`,
          regulationConsent: true,
          status: "ACTIVE",
        },
      });
      const wallet = await prisma.wallet.create({
        data: {
          clinicId,
          patientId: patient.id,
          status: "ACTIVE",
          availableBalance: 0,
          pendingBalance: 0,
          pointsBalance: 0,
        },
      });
      walletId = wallet.id;
      patientId = patient.id;
    });
  });

  afterAll(async () => {
    if (!patientId || !organizationId) return;
    await comOrganizacao({ organizationId }, async () => {
      await prisma.ledgerEntry.deleteMany({ where: { patientId } });
      await prisma.creditLot.deleteMany({ where: { walletId } });
      await prisma.wallet.deleteMany({ where: { patientId } });
      await prisma.patient.deleteMany({ where: { id: patientId } });
    });
  });

  teste("credita só pontos sem lote de cashback e sem pó 0.0001", async () => {
    const result = await creditWallet({
      clinicId,
      walletId,
      patientId,
      amount: 0,
      points: 40,
      type: "CREDIT_ADJUSTMENT",
      origin: "test-points",
      availableAt: new Date(),
      idempotencyKey: `pts-only-${walletId}`,
    });

    expect(result.lot).toBeNull();
    expect(Number(result.entry.amount)).toBe(0);
    expect(result.entry.points).toBe(40);

    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.pointsBalance).toBe(40);
    expect(Number(wallet?.availableBalance)).toBe(0);
  });

  teste("recusa crédito sem valor e sem pontos", async () => {
    await expect(
      creditWallet({
        clinicId,
        walletId,
        patientId,
        amount: 0,
        points: 0,
        availableAt: new Date(),
        idempotencyKey: `pts-vazio-${walletId}`,
      }),
    ).rejects.toThrow(LedgerError);
  });

  teste("estorna pontos do crédito e do débito de recompensa", async () => {
    await prisma.wallet.update({
      where: { id: walletId },
      data: { pointsBalance: 0 },
    });

    const credit = await creditWallet({
      clinicId,
      walletId,
      patientId,
      amount: 0,
      points: 25,
      type: "CREDIT_ADJUSTMENT",
      origin: "test-points-rev",
      availableAt: new Date(),
      idempotencyKey: `pts-rev-credit-${walletId}`,
    });

    await prisma.$transaction((tx) =>
      debitPointsInTx(tx, {
        clinicId,
        walletId,
        patientId,
        points: 10,
        origin: "raffle",
        type: "DEBIT_REWARD",
        reason: "teste bilhete",
        idempotencyKey: `pts-rev-debit-${walletId}`,
      }),
    );

    let wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.pointsBalance).toBe(15);

    const debit = await prisma.ledgerEntry.findFirst({
      where: { clinicId, idempotencyKey: `pts-rev-debit-${walletId}` },
    });
    expect(debit).toBeTruthy();

    await reverseLedgerEntry({
      clinicId,
      entryId: debit!.id,
      operatorId,
      reason: "estorno débito pontos",
      idempotencyKey: `rev-debit-${walletId}`,
    });

    wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.pointsBalance).toBe(25);

    await reverseLedgerEntry({
      clinicId,
      entryId: credit.entry.id,
      operatorId,
      reason: "estorno crédito pontos",
      idempotencyKey: `rev-credit-${walletId}`,
    });

    wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.pointsBalance).toBe(0);
  });
});
