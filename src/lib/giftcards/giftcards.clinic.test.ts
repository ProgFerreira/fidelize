import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { activateGiftCard } from "./index";

const runDb = process.env.RUN_DB_TESTS === "1";

describe.runIf(runDb)("vale-presente isolado por clínica", () => {
  let clinicId = "";
  let organizationId = "";
  let giftCardId = "";
  const code = `GPTST${Date.now().toString(36).toUpperCase()}`;

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

    await comOrganizacao({ organizationId }, async () => {
      const card = await prisma.giftCard.create({
        data: {
          clinicId,
          code,
          initialAmount: "50.0000",
          remainingAmount: "50.0000",
          status: "PENDING_PAYMENT",
        },
      });
      giftCardId = card.id;
    });
  });

  afterAll(async () => {
    if (!giftCardId || !organizationId) return;
    await comOrganizacao({ organizationId }, async () => {
      await prisma.giftCardTransaction.deleteMany({
        where: { giftCardId },
      });
      await prisma.giftCard.deleteMany({ where: { id: giftCardId } });
    });
  });

  teste("não ativa vale de outra clínica", async () => {
    await expect(
      activateGiftCard({
        clinicId: "clinica-outra",
        giftCardId,
      }),
    ).rejects.toThrow(/Vale inválido/);

    const card = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
    expect(card?.status).toBe("PENDING_PAYMENT");
  });

  teste("ativa depois de confirmar a clínica", async () => {
    const card = await activateGiftCard({ clinicId, giftCardId });
    expect(card.status).toBe("ACTIVE");
  });
});
