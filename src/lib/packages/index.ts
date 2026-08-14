import { prisma } from "@/lib/db";
import { organizacaoAtual } from "@/lib/tenant";

export type PackageDTO = {
  id: string;
  procedureId: string;
  procedureName: string;
  totalSessions: number;
  remainingSessions: number;
  expiresAt: string | null;
  status: string;
};

function toDTO(row: {
  id: string;
  procedureId: string;
  totalSessions: number;
  remainingSessions: number;
  expiresAt: Date | null;
  status: string;
  procedure: { name: string };
}): PackageDTO {
  return {
    id: row.id,
    procedureId: row.procedureId,
    procedureName: row.procedure.name,
    totalSessions: row.totalSessions,
    remainingSessions: row.remainingSessions,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    status: row.status,
  };
}

export async function listActivePackages(params: {
  clinicId: string;
  patientId: string;
}) {
  const now = new Date();
  await prisma.treatmentPackage.updateMany({
    where: {
      clinicId: params.clinicId,
      patientId: params.patientId,
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  const rows = await prisma.treatmentPackage.findMany({
    where: {
      clinicId: params.clinicId,
      patientId: params.patientId,
      status: "ACTIVE",
      remainingSessions: { gt: 0 },
    },
    include: { procedure: { select: { name: true } } },
    orderBy: { expiresAt: "asc" },
  });
  return rows.map(toDTO);
}

export async function issuePackagesFromSale(params: {
  clinicId: string;
  patientId: string;
  appointmentId: string;
  items: Array<{
    procedureId: string | null;
    quantity: number;
  }>;
}) {
  const procedureIds = [
    ...new Set(
      params.items
        .map((i) => i.procedureId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (procedureIds.length === 0) return [];

  const procedures = await prisma.procedure.findMany({
    where: {
      clinicId: params.clinicId,
      id: { in: procedureIds },
      packageSessions: { gte: 2 },
    },
    select: {
      id: true,
      name: true,
      packageSessions: true,
      validityDays: true,
    },
  });
  if (procedures.length === 0) return [];

  const byId = Object.fromEntries(procedures.map((p) => [p.id, p]));
  const created = [];

  for (const item of params.items) {
    if (!item.procedureId) continue;
    const procedure = byId[item.procedureId];
    if (!procedure?.packageSessions || procedure.packageSessions < 2) continue;
    const total = procedure.packageSessions * Math.max(1, item.quantity);
    const expiresAt =
      procedure.validityDays && procedure.validityDays > 0
        ? new Date(Date.now() + procedure.validityDays * 24 * 60 * 60 * 1000)
        : null;

    const row = await prisma.treatmentPackage.create({
      data: {
        organizationId: organizacaoAtual(),
        clinicId: params.clinicId,
        patientId: params.patientId,
        procedureId: procedure.id,
        appointmentId: params.appointmentId,
        totalSessions: total,
        remainingSessions: total,
        expiresAt,
        status: "ACTIVE",
      },
      include: { procedure: { select: { name: true } } },
    });
    created.push(toDTO(row));
  }

  return created;
}

export async function consumePackageSession(params: {
  clinicId: string;
  patientId: string;
  procedureId: string | null;
  scheduleEventId: string;
}) {
  if (!params.procedureId) return null;

  const pkg = await prisma.treatmentPackage.findFirst({
    where: {
      clinicId: params.clinicId,
      patientId: params.patientId,
      procedureId: params.procedureId,
      status: "ACTIVE",
      remainingSessions: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { procedure: { select: { name: true } } },
    orderBy: { expiresAt: "asc" },
  });
  if (!pkg) return null;

  const already = await prisma.treatmentPackageUse.findFirst({
    where: { packageId: pkg.id, scheduleEventId: params.scheduleEventId },
  });
  if (already) return toDTO(pkg);

  const remaining = pkg.remainingSessions - 1;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.treatmentPackageUse.create({
      data: {
        packageId: pkg.id,
        scheduleEventId: params.scheduleEventId,
      },
    });
    return tx.treatmentPackage.update({
      where: { id: pkg.id },
      data: {
        remainingSessions: remaining,
        status: remaining <= 0 ? "EXHAUSTED" : "ACTIVE",
      },
      include: { procedure: { select: { name: true } } },
    });
  });

  return toDTO(updated);
}
