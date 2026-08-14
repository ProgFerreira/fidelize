import { prisma } from "@/lib/db";

export async function resolveBenefitWallet(params: {
  clinicId: string;
  patientId: string;
}) {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, clinicId: params.clinicId },
    select: {
      id: true,
      fullName: true,
      holderPatientId: true,
      holder: { select: { id: true, fullName: true } },
    },
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const ownerId = patient.holderPatientId || patient.id;
  const wallet = await prisma.wallet.findFirst({
    where: { clinicId: params.clinicId, patientId: ownerId, status: "ACTIVE" },
    include: { category: true, patient: { select: { id: true, fullName: true } } },
  });
  if (!wallet) throw new Error("Carteira do titular não encontrada");

  return {
    wallet,
    attendingPatientId: patient.id,
    holderPatientId: ownerId,
    shared: Boolean(patient.holderPatientId),
    holderName: patient.holder?.fullName ?? patient.fullName,
  };
}

export async function listFamily(params: { clinicId: string; patientId: string }) {
  const patient = await prisma.patient.findFirst({
    where: { id: params.patientId, clinicId: params.clinicId },
    select: {
      id: true,
      fullName: true,
      holderPatientId: true,
      holder: { select: { id: true, fullName: true, phone: true } },
      dependents: {
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, phone: true },
        orderBy: { fullName: "asc" },
      },
    },
  });
  return patient;
}

export async function linkDependent(params: {
  clinicId: string;
  dependentId: string;
  holderId: string;
}) {
  if (params.dependentId === params.holderId) {
    throw new Error("O titular não pode ser dependente de si mesmo");
  }
  const [holder, dependent] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: params.holderId, clinicId: params.clinicId },
      select: { id: true, holderPatientId: true },
    }),
    prisma.patient.findFirst({
      where: { id: params.dependentId, clinicId: params.clinicId },
      select: { id: true, holderPatientId: true },
    }),
  ]);
  if (!holder || !dependent) throw new Error("Paciente não encontrado");
  if (holder.holderPatientId) {
    throw new Error("O titular escolhido já é dependente de outra carteira");
  }
  return prisma.patient.update({
    where: { id: dependent.id },
    data: { holderPatientId: holder.id },
  });
}

export async function unlinkDependent(params: {
  clinicId: string;
  dependentId: string;
}) {
  const dependent = await prisma.patient.findFirst({
    where: { id: params.dependentId, clinicId: params.clinicId },
    select: { id: true },
  });
  if (!dependent) throw new Error("Paciente não encontrado");
  return prisma.patient.update({
    where: { id: dependent.id },
    data: { holderPatientId: null },
  });
}
