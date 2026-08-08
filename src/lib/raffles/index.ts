import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule } from "@/lib/modules";
import { creditWallet } from "@/lib/ledger";
import type { RaffleStatus } from "@/generated/prisma/client";

export const raffleSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  ticketCostPoints: z.coerce.number().int().min(1).default(50),
  maxTicketsPerPatient: z.coerce.number().int().optional().nullable(),
  maxTicketsTotal: z.coerce.number().int().optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  prizeDescription: z.string().min(2).max(500),
  prizeCashback: z.coerce.number().optional().nullable(),
  prizePoints: z.coerce.number().int().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "CANCELLED"]).default("DRAFT"),
});

export async function createRaffle(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof raffleSchema>;
}) {
  await requireModule(input.clinicId, "RAFFLES");
  const data = raffleSchema.parse(input.data);
  if (data.endsAt <= data.startsAt) throw new Error("Vigência inválida");

  const raffle = await prisma.raffle.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      description: data.description ?? null,
      ticketCostPoints: data.ticketCostPoints,
      maxTicketsPerPatient: data.maxTicketsPerPatient ?? null,
      maxTicketsTotal: data.maxTicketsTotal ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      prizeDescription: data.prizeDescription,
      prizeCashback: data.prizeCashback != null ? String(data.prizeCashback) : null,
      prizePoints: data.prizePoints ?? null,
      status: data.status as RaffleStatus,
    },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "RAFFLE_CHANGE",
    entityType: "Raffle",
    entityId: raffle.id,
    afterData: { name: raffle.name, status: raffle.status },
  });

  return raffle;
}

export async function setRaffleStatus(input: {
  clinicId: string;
  raffleId: string;
  status: RaffleStatus;
  actorId?: string;
}) {
  const raffle = await prisma.raffle.update({
    where: { id: input.raffleId },
    data: { status: input.status },
  });
  if (raffle.clinicId !== input.clinicId) throw new Error("Sorteio inválido");
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "RAFFLE_CHANGE",
    entityType: "Raffle",
    entityId: raffle.id,
    afterData: { status: raffle.status },
  });
  return raffle;
}

export async function buyRaffleTicket(input: {
  clinicId: string;
  raffleId: string;
  patientId: string;
  quantity?: number;
}) {
  await requireModule(input.clinicId, "RAFFLES");
  const qty = Math.max(1, Math.min(input.quantity ?? 1, 20));

  return prisma.$transaction(async (tx) => {
    const raffle = await tx.raffle.findFirst({
      where: { id: input.raffleId, clinicId: input.clinicId },
    });
    if (!raffle || raffle.status !== "ACTIVE") {
      throw new Error("Sorteio indisponível");
    }
    const now = new Date();
    if (now < raffle.startsAt || now > raffle.endsAt) {
      throw new Error("Fora do período do sorteio");
    }
    if (
      raffle.maxTicketsTotal != null &&
      raffle.ticketCount + qty > raffle.maxTicketsTotal
    ) {
      throw new Error("Esgotado");
    }

    const owned = await tx.raffleTicket.count({
      where: { raffleId: raffle.id, patientId: input.patientId },
    });
    if (
      raffle.maxTicketsPerPatient != null &&
      owned + qty > raffle.maxTicketsPerPatient
    ) {
      throw new Error("Limite de bilhetes por paciente");
    }

    const wallet = await tx.wallet.findFirst({
      where: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        status: "ACTIVE",
      },
    });
    if (!wallet) throw new Error("Carteira não encontrada");

    const cost = raffle.ticketCostPoints * qty;
    if (wallet.pointsBalance < cost) {
      throw new Error("Pontos insuficientes");
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { pointsBalance: { decrement: cost }, version: { increment: 1 } },
    });

    const tickets = [];
    for (let i = 0; i < qty; i++) {
      const ticketNumber = raffle.ticketCount + i + 1;
      tickets.push(
        await tx.raffleTicket.create({
          data: {
            raffleId: raffle.id,
            clinicId: input.clinicId,
            patientId: input.patientId,
            ticketNumber,
            pointsSpent: raffle.ticketCostPoints,
          },
        }),
      );
    }

    await tx.raffle.update({
      where: { id: raffle.id },
      data: { ticketCount: { increment: qty } },
    });

    await writeAuditLog({
      clinicId: input.clinicId,
      action: "RAFFLE_CHANGE",
      entityType: "RaffleTicket",
      entityId: tickets[0]?.id,
      afterData: { raffleId: raffle.id, quantity: qty, pointsSpent: cost },
    });

    return { tickets, pointsSpent: cost };
  });
}

export async function drawRaffle(input: {
  clinicId: string;
  raffleId: string;
  actorId?: string;
}) {
  await requireModule(input.clinicId, "RAFFLES");
  const raffle = await prisma.raffle.findFirst({
    where: { id: input.raffleId, clinicId: input.clinicId },
    include: { tickets: true },
  });
  if (!raffle) throw new Error("Sorteio não encontrado");
  if (raffle.status === "DRAWN") throw new Error("Já sorteado");
  if (!raffle.tickets.length) throw new Error("Sem bilhetes");

  const winner = raffle.tickets[randomInt(raffle.tickets.length)];

  if (raffle.prizeCashback || raffle.prizePoints) {
    const wallet = await prisma.wallet.findFirst({
      where: {
        clinicId: input.clinicId,
        patientId: winner.patientId,
        status: "ACTIVE",
      },
    });
    if (wallet) {
      await creditWallet({
        clinicId: input.clinicId,
        walletId: wallet.id,
        patientId: winner.patientId,
        amount: Number(raffle.prizeCashback ?? 0) || 0.0001,
        points: raffle.prizePoints ?? 0,
        type: "CREDIT_ADJUSTMENT",
        origin: "raffle",
        reason: `Prêmio sorteio ${raffle.name}`,
        availableAt: new Date(),
        idempotencyKey: `raffle-prize:${raffle.id}`,
      });
    }
  }

  const updated = await prisma.raffle.update({
    where: { id: raffle.id },
    data: {
      status: "DRAWN",
      drawnAt: new Date(),
      winnerTicketId: winner.id,
    },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "RAFFLE_CHANGE",
    entityType: "Raffle",
    entityId: raffle.id,
    afterData: {
      status: "DRAWN",
      winnerTicketId: winner.id,
      winnerPatientId: winner.patientId,
    },
  });

  return { raffle: updated, winner };
}

export async function listRaffles(clinicId: string) {
  return prisma.raffle.findMany({
    where: { clinicId },
    include: {
      tickets: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { patient: { select: { fullName: true } } },
      },
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
