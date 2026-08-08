import { prisma } from "@/lib/db";
import { requireModule, isModuleEnabled } from "@/lib/modules";
import { runAutomationsForTrigger } from "@/lib/automations";
import { assignTag } from "@/lib/tags";
import type { RecoveryStatus } from "@/generated/prisma/client";

const DEFAULT_THRESHOLDS = {
  attention: 30,
  risk: 60,
  inactive: 90,
};

export async function getRecoverySettings(clinicId: string) {
  const setting = await prisma.setting.findUnique({
    where: { clinicId_key: { clinicId, key: "recovery.thresholds" } },
  });
  return {
    ...DEFAULT_THRESHOLDS,
    ...((setting?.value as Record<string, number> | null) ?? {}),
  };
}

export async function classifyInactivePatients(clinicId: string) {
  if (!(await isModuleEnabled(clinicId, "AUTOMATIONS"))) {
    // recuperação pode rodar mesmo assim se módulo implícito; exige recovery via tags
  }
  await requireModule(clinicId, "TAGS");
  const thresholds = await getRecoverySettings(clinicId);
  const patients = await prisma.patient.findMany({
    where: { clinicId, status: "ACTIVE" },
    include: {
      appointments: {
        where: { status: "CONFIRMED" },
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
      wallets: true,
    },
  });

  const now = Date.now();
  const results = [];

  for (const patient of patients) {
    const last = patient.appointments[0]?.occurredAt ?? patient.registeredAt;
    const days = Math.floor((now - last.getTime()) / (24 * 60 * 60 * 1000));
    let status: RecoveryStatus | null = null;
    let tagSlug: string | null = null;
    if (days >= thresholds.inactive) {
      status = "INACTIVE";
      tagSlug = "sem-retorno-90";
    } else if (days >= thresholds.risk) {
      status = "RISK";
      tagSlug = "sem-retorno-60";
    } else if (days >= thresholds.attention) {
      status = "ATTENTION";
      tagSlug = "sem-retorno-30";
    }
    if (!status || !tagSlug) continue;

    const open = await prisma.recoveryCase.findFirst({
      where: {
        clinicId,
        patientId: patient.id,
        status: { in: ["ATTENTION", "RISK", "INACTIVE"] },
      },
    });

    const caseRow = open
      ? await prisma.recoveryCase.update({
          where: { id: open.id },
          data: { status, inactiveDays: days },
        })
      : await prisma.recoveryCase.create({
          data: {
            clinicId,
            patientId: patient.id,
            status,
            inactiveDays: days,
          },
        });

    const tag = await prisma.customerTag.findFirst({
      where: { clinicId, slug: tagSlug },
    });
    if (tag) {
      await assignTag({
        clinicId,
        patientId: patient.id,
        tagId: tag.id,
        source: "AUTOMATIC",
      });
    }

    await runAutomationsForTrigger({
      clinicId,
      trigger: "PATIENT_INACTIVE",
      patientId: patient.id,
      triggerRef: `inactive:${status}:${Math.floor(days / 30)}`,
      context: { walletId: patient.wallets[0]?.id },
    });

    results.push(caseRow);
  }

  return results;
}

export async function markRecoveredOnAppointment(input: {
  clinicId: string;
  patientId: string;
}) {
  const openCases = await prisma.recoveryCase.findMany({
    where: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      status: { in: ["ATTENTION", "RISK", "INACTIVE"] },
    },
  });
  for (const item of openCases) {
    await prisma.recoveryCase.update({
      where: { id: item.id },
      data: {
        status: "RECOVERED",
        recoveredAt: new Date(),
        closedAt: new Date(),
      },
    });
  }

  // Remove etiquetas de inatividade automáticas
  const inactivitySlugs = ["sem-retorno-30", "sem-retorno-60", "sem-retorno-90"];
  for (const slug of inactivitySlugs) {
    const tag = await prisma.customerTag.findFirst({
      where: { clinicId: input.clinicId, slug },
    });
    if (!tag) continue;
    const assignment = await prisma.customerTagAssignment.findUnique({
      where: {
        tagId_patientId: { tagId: tag.id, patientId: input.patientId },
      },
    });
    if (assignment && !assignment.removedAt && assignment.source === "AUTOMATIC") {
      const { removeTag } = await import("@/lib/tags");
      await removeTag({
        clinicId: input.clinicId,
        patientId: input.patientId,
        tagId: tag.id,
      });
    }
  }

  try {
    const { cancelQueuedForPatient } = await import("@/lib/communications");
    await cancelQueuedForPatient(input.clinicId, input.patientId);
  } catch {
    // best-effort
  }

  return openCases.length;
}

export async function listRecoveryCases(clinicId: string) {
  return prisma.recoveryCase.findMany({
    where: { clinicId },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });
}
