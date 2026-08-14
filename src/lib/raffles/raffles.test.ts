import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { setRaffleStatus } from "./index";

const runDb = process.env.RUN_DB_TESTS === "1";

describe.runIf(runDb)("sorteio isolado por clínica", () => {
  let clinicId = "";
  let organizationId = "";
  let raffleId = "";

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
      const raffle = await prisma.raffle.create({
        data: {
          clinicId,
          name: "Sorteio teste isolamento",
          ticketCostPoints: 10,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 86400000),
          prizeDescription: "Brinde teste",
          status: "DRAFT",
        },
      });
      raffleId = raffle.id;
    });
  });

  afterAll(async () => {
    if (!raffleId || !organizationId) return;
    await comOrganizacao({ organizationId }, async () => {
      await prisma.raffleTicket.deleteMany({ where: { raffleId } });
      await prisma.raffle.deleteMany({ where: { id: raffleId } });
    });
  });

  teste("não altera sorteio de outra clínica", async () => {
    await expect(
      setRaffleStatus({
        clinicId: "clinica-outra",
        raffleId,
        status: "ACTIVE",
      }),
    ).rejects.toThrow(/Sorteio inválido/);

    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
    expect(raffle?.status).toBe("DRAFT");
  });

  teste("atualiza status só depois de achar o sorteio da clínica", async () => {
    const updated = await setRaffleStatus({
      clinicId,
      raffleId,
      status: "ACTIVE",
    });
    expect(updated.status).toBe("ACTIVE");
  });
});
