import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { requireModule, isModuleEnabled } from "@/lib/modules";
import { enqueueCommunication } from "@/lib/communications";
import { assignTag, removeTag } from "@/lib/tags";
import { creditWallet } from "@/lib/ledger";
import type { AutomationTrigger, CommunicationChannel, Prisma } from "@/generated/prisma/client";

export const automationSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().nullable(),
  trigger: z.enum([
    "PATIENT_REGISTERED",
    "FIRST_APPOINTMENT",
    "PAYMENT_CONFIRMED",
    "CASHBACK_RELEASED",
    "POINTS_GRANTED",
    "CATEGORY_CHANGED",
    "BALANCE_EXPIRING",
    "BALANCE_EXPIRED",
    "BIRTHDAY",
    "PATIENT_INACTIVE",
    "NPS_RESPONDED",
    "REFERRAL_CREATED",
    "REFERRAL_CONVERTED",
    "VOUCHER_ISSUED",
    "VOUCHER_EXPIRING",
    "CAMPAIGN_STARTED",
    "SCHEDULED",
  ]),
  conditions: z.record(z.string(), z.any()).optional().nullable(),
  steps: z
    .array(
      z.object({
        actionType: z.string(),
        config: z.record(z.string(), z.any()),
        delayMinutes: z.number().int().min(0).default(0),
      }),
    )
    .min(1),
});

export const AUTOMATION_PRESETS = [
  {
    name: "Boas-vindas",
    trigger: "PATIENT_REGISTERED" as const,
    steps: [
      {
        actionType: "SEND_WHATSAPP",
        config: { body: "Bem-vindo(a), {{nome_paciente}}! Seu clube de benefícios está ativo." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Cashback recebido",
    trigger: "CASHBACK_RELEASED" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "{{nome_paciente}}, seu cashback já está disponível. Saldo: {{saldo}}." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Pontos recebidos",
    trigger: "POINTS_GRANTED" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "{{nome_paciente}}, você recebeu {{pontos}} pontos." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Mudança de categoria",
    trigger: "CATEGORY_CHANGED" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "Parabéns, {{nome_paciente}}! Sua categoria foi atualizada." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Aniversário",
    trigger: "BIRTHDAY" as const,
    steps: [
      {
        actionType: "SEND_WHATSAPP",
        config: { body: "Feliz aniversário, {{nome_paciente}}! Temos um benefício especial para você." },
        delayMinutes: 0,
      },
      {
        actionType: "CREDIT_POINTS",
        config: { points: 50 },
        delayMinutes: 0,
      },
      {
        actionType: "ISSUE_VOUCHER",
        config: { name: "Aniversário", type: "BIRTHDAY", valuePercent: 10 },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Saldo vencendo",
    trigger: "BALANCE_EXPIRING" as const,
    steps: [
      {
        actionType: "SEND_WHATSAPP",
        config: { body: "{{nome_paciente}}, seu saldo de {{saldo}} vence em breve." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Paciente ausente 30 dias",
    trigger: "PATIENT_INACTIVE" as const,
    steps: [
      {
        actionType: "APPLY_TAG",
        config: { tagSlug: "sem-retorno-30" },
        delayMinutes: 0,
      },
      {
        actionType: "SEND_WHATSAPP",
        config: { body: "Sentimos sua falta, {{nome_paciente}}. Que tal agendar um retorno?" },
        delayMinutes: 0,
      },
      {
        actionType: "CREATE_TASK",
        config: { notes: "Ligar para paciente inativo há 30+ dias" },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Paciente ausente 60 dias",
    trigger: "PATIENT_INACTIVE" as const,
    steps: [
      {
        actionType: "APPLY_TAG",
        config: { tagSlug: "sem-retorno-60" },
        delayMinutes: 0,
      },
      {
        actionType: "SEND_WHATSAPP",
        config: { body: "{{nome_paciente}}, preparamos um benefício especial para o seu retorno." },
        delayMinutes: 0,
      },
      {
        actionType: "ISSUE_VOUCHER",
        config: { name: "Retorno", type: "RECOVERY", valuePercent: 15 },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Pós-atendimento",
    trigger: "PAYMENT_CONFIRMED" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "Obrigado pela visita, {{nome_paciente}}! Seu benefício já está sendo processado." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Pesquisa de satisfação",
    trigger: "PAYMENT_CONFIRMED" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "{{nome_paciente}}, conte como foi sua experiência conosco." },
        delayMinutes: 60,
      },
    ],
  },
  {
    name: "Indicação convertida",
    trigger: "REFERRAL_CONVERTED" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "Sua indicação foi convertida! O benefício já está na sua carteira." },
        delayMinutes: 0,
      },
    ],
  },
  {
    name: "Voucher próximo de vencer",
    trigger: "VOUCHER_EXPIRING" as const,
    steps: [
      {
        actionType: "SEND_INTERNAL",
        config: { body: "{{nome_paciente}}, você tem um voucher próximo do vencimento." },
        delayMinutes: 0,
      },
    ],
  },
];

function conditionsMatch(
  conditions: Record<string, unknown> | null | undefined,
  ctx: { unitId?: string | null; categoryId?: string | null; visits?: number },
) {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  if (conditions.unitId && conditions.unitId !== ctx.unitId) return false;
  if (conditions.categoryId && conditions.categoryId !== ctx.categoryId) return false;
  if (conditions.minVisits != null && (ctx.visits ?? 0) < Number(conditions.minVisits)) {
    return false;
  }
  return true;
}

export async function createAutomation(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof automationSchema>;
}) {
  await requireModule(input.clinicId, "AUTOMATIONS");
  const data = automationSchema.parse(input.data);

  const automation = await prisma.automation.create({
    data: {
      clinicId: input.clinicId,
      name: data.name,
      description: data.description ?? null,
      trigger: data.trigger as AutomationTrigger,
      status: "DRAFT",
      conditions: (data.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
      currentVersion: 1,
      versions: {
        create: {
          version: 1,
          snapshot: data as unknown as Prisma.InputJsonValue,
          publishedBy: input.actorId,
          steps: {
            create: data.steps.map((step, index) => ({
              sortOrder: index,
              actionType: step.actionType,
              config: step.config as Prisma.InputJsonValue,
              delayMinutes: step.delayMinutes,
            })),
          },
        },
      },
    },
    include: { versions: { include: { steps: true } } },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "AUTOMATION_CHANGE",
    entityType: "Automation",
    entityId: automation.id,
    afterData: { name: automation.name, trigger: automation.trigger },
  });

  return automation;
}

export async function setAutomationStatus(input: {
  clinicId: string;
  automationId: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DRAFT";
  actorId?: string;
}) {
  const automation = await prisma.automation.update({
    where: { id: input.automationId },
    data: { status: input.status },
  });
  if (automation.clinicId !== input.clinicId) throw new Error("Automação inválida");
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "AUTOMATION_CHANGE",
    entityType: "Automation",
    entityId: automation.id,
    afterData: { status: automation.status },
  });
  return automation;
}

export async function runAutomationsForTrigger(input: {
  clinicId: string;
  trigger: AutomationTrigger;
  patientId: string;
  triggerRef: string;
  automationId?: string;
  context?: {
    unitId?: string | null;
    categoryId?: string | null;
    visits?: number;
    walletId?: string;
    variables?: Record<string, string | number>;
  };
}) {
  if (!(await isModuleEnabled(input.clinicId, "AUTOMATIONS"))) return [];

  const automations = await prisma.automation.findMany({
    where: {
      clinicId: input.clinicId,
      trigger: input.trigger,
      status: input.automationId ? undefined : "ACTIVE",
      ...(input.automationId ? { id: input.automationId } : {}),
    },
    include: {
      versions: {
        where: {},
        orderBy: { version: "desc" },
        take: 1,
        include: { steps: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId: input.clinicId },
    include: { wallets: true },
  });
  if (!patient) return [];

  const wallet = patient.wallets[0];
  const results = [];

  for (const automation of automations) {
    const version = automation.versions[0];
    if (!version) continue;

    const conditions = automation.conditions as Record<string, unknown> | null;
    if (
      !conditionsMatch(conditions, {
        unitId: input.context?.unitId ?? patient.unitId,
        categoryId: input.context?.categoryId ?? wallet?.categoryId,
        visits: input.context?.visits ?? wallet?.appointmentCount,
      })
    ) {
      continue;
    }

    const idempotencyKey = `${automation.id}:${input.patientId}:${input.triggerRef}`;
    const existing = await prisma.automationExecution.findUnique({
      where: {
        clinicId_idempotencyKey: {
          clinicId: input.clinicId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      results.push(existing);
      continue;
    }

    const execution = await prisma.automationExecution.create({
      data: {
        clinicId: input.clinicId,
        automationId: automation.id,
        patientId: input.patientId,
        triggerRef: input.triggerRef,
        status: "RUNNING",
        idempotencyKey,
      },
    });

    try {
      for (const step of version.steps) {
        const stepKey = `${idempotencyKey}:${step.id}`;
        const actionExec = await prisma.automationActionExecution.create({
          data: {
            executionId: execution.id,
            stepId: step.id,
            status: "RUNNING",
            idempotencyKey: stepKey,
            ranAt: new Date(),
          },
        });

        const config = step.config as Record<string, unknown>;
        if (step.delayMinutes > 0 && String(step.actionType).startsWith("SEND_")) {
          let channel: CommunicationChannel =
            step.actionType === "SEND_WHATSAPP"
              ? "WHATSAPP"
              : step.actionType === "SEND_EMAIL"
                ? "EMAIL"
                : step.actionType === "SEND_SMS"
                  ? "SMS"
                  : "INTERNAL";
          if (channel === "WHATSAPP" && !(await isModuleEnabled(input.clinicId, "WHATSAPP"))) {
            channel = "INTERNAL";
          }
          try {
            await enqueueCommunication({
              clinicId: input.clinicId,
              data: {
                patientId: input.patientId,
                channel,
                purpose: "SERVICE",
                body: String(config.body ?? ""),
                variables: {
                  nome_paciente: patient.fullName,
                  saldo: wallet ? String(wallet.availableBalance) : "0",
                  pontos: wallet?.pointsBalance ?? 0,
                  ...input.context?.variables,
                },
                automationId: automation.id,
                scheduledAt: new Date(Date.now() + step.delayMinutes * 60_000),
                idempotencyKey: `auto:${automation.id}:${input.triggerRef}:${channel}:d${step.delayMinutes}`,
              },
            });
          } catch {
            // canal indisponível
          }
        } else {
          await executeStep({
            clinicId: input.clinicId,
            patientId: input.patientId,
            walletId: input.context?.walletId ?? wallet?.id,
            actionType: step.actionType,
            config,
            variables: {
              nome_paciente: patient.fullName,
              saldo: wallet ? String(wallet.availableBalance) : "0",
              pontos: wallet?.pointsBalance ?? 0,
              ...input.context?.variables,
            },
            automationId: automation.id,
            triggerRef: input.triggerRef,
          });
        }

        await prisma.automationActionExecution.update({
          where: { id: actionExec.id },
          data: { status: "COMPLETED", result: { ok: true } },
        });
      }

      const done = await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
      await writeAuditLog({
        clinicId: input.clinicId,
        action: "AUTOMATION_RUN",
        entityType: "AutomationExecution",
        entityId: done.id,
        afterData: { automationId: automation.id, patientId: input.patientId },
      });
      results.push(done);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro";
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      throw error;
    }
  }

  return results;
}

async function executeStep(input: {
  clinicId: string;
  patientId: string;
  walletId?: string;
  actionType: string;
  config: Record<string, unknown>;
  variables: Record<string, string | number>;
  automationId: string;
  triggerRef: string;
}) {
  switch (input.actionType) {
    case "SEND_WHATSAPP":
    case "SEND_EMAIL":
    case "SEND_SMS":
    case "SEND_INTERNAL": {
      let channel: CommunicationChannel =
        input.actionType === "SEND_WHATSAPP"
          ? "WHATSAPP"
          : input.actionType === "SEND_EMAIL"
            ? "EMAIL"
            : input.actionType === "SEND_SMS"
              ? "SMS"
              : "INTERNAL";
      if (channel === "WHATSAPP") {
        const { isModuleEnabled } = await import("@/lib/modules");
        if (!(await isModuleEnabled(input.clinicId, "WHATSAPP"))) {
          channel = "INTERNAL";
        }
      }
      try {
        await enqueueCommunication({
          clinicId: input.clinicId,
          data: {
            patientId: input.patientId,
            channel,
            purpose: "SERVICE",
            body: String(input.config.body ?? ""),
            variables: input.variables,
            automationId: input.automationId,
            idempotencyKey: `auto:${input.automationId}:${input.triggerRef}:${channel}`,
          },
        });
      } catch {
        if (channel !== "INTERNAL") {
          await enqueueCommunication({
            clinicId: input.clinicId,
            data: {
              patientId: input.patientId,
              channel: "INTERNAL",
              purpose: "SERVICE",
              body: String(input.config.body ?? ""),
              variables: input.variables,
              automationId: input.automationId,
              idempotencyKey: `auto:${input.automationId}:${input.triggerRef}:INTERNAL`,
            },
          });
        }
      }
      break;
    }
    case "CREDIT_POINTS":
    case "CREDIT_CASHBACK": {
      if (!input.walletId) throw new Error("Carteira ausente para crédito");
      const points = Number(input.config.points ?? 0);
      const amountRaw = Number(input.config.amount ?? 0);
      const amount = Math.max(0, amountRaw);
      if (amount <= 0 && points <= 0) break;
      await creditWallet({
        clinicId: input.clinicId,
        walletId: input.walletId,
        patientId: input.patientId,
        amount,
        points,
        type: "CREDIT_AUTOMATION",
        origin: "automation",
        reason: String(input.config.reason ?? "Automação"),
        availableAt: new Date(),
        idempotencyKey: `auto-credit:${input.automationId}:${input.triggerRef}`,
      });
      break;
    }
    case "APPLY_TAG": {
      const slug = String(input.config.tagSlug ?? "");
      const tag = await prisma.customerTag.findFirst({
        where: { clinicId: input.clinicId, slug },
      });
      if (tag) {
        await assignTag({
          clinicId: input.clinicId,
          patientId: input.patientId,
          tagId: tag.id,
          source: "AUTOMATION",
        });
      }
      break;
    }
    case "REMOVE_TAG": {
      const slug = String(input.config.tagSlug ?? "");
      const tag = await prisma.customerTag.findFirst({
        where: { clinicId: input.clinicId, slug },
      });
      if (tag) {
        await removeTag({
          clinicId: input.clinicId,
          patientId: input.patientId,
          tagId: tag.id,
        });
      }
      break;
    }
    case "CREATE_TASK": {
      await prisma.recoveryCase.create({
        data: {
          clinicId: input.clinicId,
          patientId: input.patientId,
          status: "ATTENTION",
          notes: String(
            input.config.notes ??
              `Tarefa automática (${input.automationId})`,
          ),
          ruleConfig: {
            source: "AUTOMATION",
            automationId: input.automationId,
            triggerRef: input.triggerRef,
          },
        },
      });
      break;
    }
    case "WAIT": {
      const days = Number(input.config.days ?? 0);
      const minutes =
        Number(input.config.minutes ?? 0) || days * 24 * 60;
      if (minutes > 0 && input.config.body) {
        const scheduledAt = new Date(Date.now() + minutes * 60_000);
        await enqueueCommunication({
          clinicId: input.clinicId,
          data: {
            patientId: input.patientId,
            channel: "INTERNAL",
            purpose: "SERVICE",
            body: String(input.config.body),
            variables: input.variables,
            automationId: input.automationId,
            scheduledAt,
            idempotencyKey: `auto-wait:${input.automationId}:${input.triggerRef}`,
          },
        });
      }
      break;
    }
    case "ISSUE_VOUCHER": {
      try {
        const { createVoucher } = await import("@/lib/vouchers");
        const expiresAt = new Date();
        expiresAt.setDate(
          expiresAt.getDate() + Number(input.config.validityDays ?? 30),
        );
        await createVoucher({
          clinicId: input.clinicId,
          data: {
            name: String(input.config.name ?? "Voucher automação"),
            type: (input.config.type as
              | "FIXED_VALUE"
              | "PERCENT"
              | "PROCEDURE"
              | "GIFT"
              | "COURTESY"
              | "FEE"
              | "RECOVERY"
              | "BIRTHDAY") ?? "COURTESY",
            valueAmount:
              input.config.valueAmount != null
                ? Number(input.config.valueAmount)
                : null,
            valuePercent:
              input.config.valuePercent != null
                ? Number(input.config.valuePercent)
                : null,
            patientId: input.patientId,
            status: "ACTIVE",
            expiresAt,
            maxUsesPerPatient: 1,
            multiUse: false,
            combineCashback: true,
            combineDiscount: false,
          },
        });
      } catch {
        // módulo vouchers pode estar desligado
      }
      break;
    }
    case "END":
      break;
    default:
      throw new Error(`Ação desconhecida: ${input.actionType}`);
  }
}

export async function duplicateAutomation(input: {
  clinicId: string;
  automationId: string;
  actorId?: string;
}) {
  const source = await prisma.automation.findFirst({
    where: { id: input.automationId, clinicId: input.clinicId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { steps: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!source) throw new Error("Automação não encontrada");
  const version = source.versions[0];
  return createAutomation({
    clinicId: input.clinicId,
    actorId: input.actorId,
    data: {
      name: `${source.name} (cópia)`,
      description: source.description,
      trigger: source.trigger as z.infer<typeof automationSchema>["trigger"],
      conditions: (source.conditions as Record<string, unknown> | null) ?? null,
      steps: (version?.steps ?? []).map((s) => ({
        actionType: s.actionType,
        config: (s.config as Record<string, unknown>) ?? {},
        delayMinutes: s.delayMinutes,
      })),
    },
  });
}

export async function testAutomation(input: {
  clinicId: string;
  automationId: string;
  patientId: string;
  actorId?: string;
}) {
  const automation = await prisma.automation.findFirst({
    where: { id: input.automationId, clinicId: input.clinicId },
  });
  if (!automation) throw new Error("Automação não encontrada");
  return runAutomationsForTrigger({
    clinicId: input.clinicId,
    trigger: automation.trigger,
    patientId: input.patientId,
    triggerRef: `test:${automation.id}:${Date.now()}`,
    automationId: automation.id,
  });
}

export async function seedPresetAutomations(clinicId: string) {
  const operational = new Set([
    "Boas-vindas",
    "Aniversário",
    "Saldo vencendo",
    "Paciente ausente 30 dias",
    "Paciente ausente 60 dias",
  ]);
  for (const preset of AUTOMATION_PRESETS) {
    const exists = await prisma.automation.findFirst({
      where: { clinicId, name: preset.name },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { steps: true },
        },
      },
    });
    if (!exists) {
      await createAutomation({
        clinicId,
        data: {
          name: preset.name,
          trigger: preset.trigger,
          steps: preset.steps,
        },
      });
      continue;
    }
    if (!operational.has(preset.name)) continue;
    const steps = exists.versions[0]?.steps ?? [];
    for (const step of steps) {
      if (step.actionType !== "SEND_INTERNAL") continue;
      await prisma.automationStep.update({
        where: { id: step.id },
        data: { actionType: "SEND_WHATSAPP" },
      });
    }
  }
}

export async function listAutomations(clinicId: string) {
  return prisma.automation.findMany({
    where: { clinicId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { steps: true },
      },
      _count: { select: { executions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Cron: aniversários do dia */
export async function processBirthdays(clinicId: string) {
  if (!(await isModuleEnabled(clinicId, "BIRTHDAY"))) return [];
  const today = new Date();
  const month = today.getUTCMonth();
  const day = today.getUTCDate();
  const patients = await prisma.patient.findMany({
    where: { clinicId, status: "ACTIVE", birthDate: { not: null } },
    include: { wallets: true },
  });
  const results = [];
  for (const patient of patients) {
    if (!patient.birthDate) continue;
    if (
      patient.birthDate.getUTCMonth() !== month ||
      patient.birthDate.getUTCDate() !== day
    ) {
      continue;
    }
    const yearKey = `birthday:${today.getUTCFullYear()}`;
    results.push(
      ...(await runAutomationsForTrigger({
        clinicId,
        trigger: "BIRTHDAY",
        patientId: patient.id,
        triggerRef: yearKey,
        context: { walletId: patient.wallets[0]?.id },
      })),
    );
  }
  return results;
}

/** Cron: saldo próximo de expirar (7 dias) */
export async function processExpiringBalances(clinicId: string) {
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const lots = await prisma.creditLot.findMany({
    where: {
      clinicId,
      status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
      expiresAt: { lte: in7, gte: new Date() },
    },
    include: { wallet: true },
  });
  const seen = new Set<string>();
  const results = [];
  for (const lot of lots) {
    if (seen.has(lot.walletId)) continue;
    seen.add(lot.walletId);
    results.push(
      ...(await runAutomationsForTrigger({
        clinicId,
        trigger: "BALANCE_EXPIRING",
        patientId: lot.wallet.patientId,
        triggerRef: `expiring:${lot.walletId}:${in7.toISOString().slice(0, 10)}`,
        context: { walletId: lot.walletId },
      })),
    );
  }
  return results;
}
