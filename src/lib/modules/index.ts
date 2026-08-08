import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type { ModuleCode, Prisma } from "@/generated/prisma/client";

export const MODULE_CATALOG: Array<{
  code: ModuleCode;
  name: string;
  description: string;
  core?: boolean;
}> = [
  { code: "CASHBACK", name: "Cashback", description: "Saldo promocional por atendimento", core: true },
  { code: "POINTS", name: "Pontos", description: "Acúmulo de pontos de fidelidade", core: true },
  { code: "CATEGORIES", name: "Categorias", description: "Níveis Bronze a Diamante", core: true },
  { code: "TAGS", name: "Etiquetas", description: "CRM e etiquetas de pacientes" },
  { code: "SEGMENTS", name: "Segmentos", description: "Públicos dinâmicos" },
  { code: "CONSENT", name: "Consentimento", description: "Preferências e LGPD" },
  { code: "COMMUNICATIONS", name: "Comunicações", description: "Central unificada de mensagens" },
  { code: "REFERRAL", name: "Indicação", description: "Paciente indica paciente" },
  { code: "REWARDS", name: "Catálogo de recompensas", description: "Troca de pontos" },
  { code: "VOUCHERS", name: "Cupons", description: "Cupons rastreáveis" },
  { code: "GIFT_CARD", name: "Vale-presente", description: "Pré-pago digital" },
  { code: "NPS", name: "NPS", description: "Pesquisas de satisfação" },
  { code: "BIRTHDAY", name: "Aniversário", description: "Benefícios de aniversário" },
  { code: "AUTOMATIONS", name: "Automações", description: "Motor de relacionamento" },
  { code: "WHATSAPP", name: "WhatsApp", description: "Canal WhatsApp" },
  { code: "EMAIL", name: "E-mail", description: "Canal e-mail" },
  { code: "SMS", name: "SMS", description: "Canal SMS" },
  { code: "PUSH", name: "Push", description: "Notificações push nativas (FCM)" },
  { code: "ACCELERATORS", name: "Aceleradores", description: "Multiplicadores temporários" },
  { code: "RAFFLES", name: "Sorteios", description: "Sorteios com bilhetes por pontos" },
  { code: "RECEIPTS", name: "Comprovantes", description: "OCR e antifraude de comprovantes" },
  { code: "PREDICTIVE", name: "Inteligência preditiva", description: "Churn, LTV e previsão de faturamento" },
];

const CORE_ENABLED: ModuleCode[] = ["CASHBACK", "POINTS", "CATEGORIES", "TAGS", "CONSENT", "COMMUNICATIONS"];

export async function ensureModulesForClinic(clinicId: string) {
  for (const mod of MODULE_CATALOG) {
    await prisma.featureModule.upsert({
      where: { clinicId_code: { clinicId, code: mod.code } },
      create: {
        clinicId,
        code: mod.code,
        enabled: CORE_ENABLED.includes(mod.code) || Boolean(mod.core),
        enabledAt: CORE_ENABLED.includes(mod.code) || mod.core ? new Date() : null,
      },
      update: {},
    });
  }
}

export async function isModuleEnabled(clinicId: string, code: ModuleCode) {
  const row = await prisma.featureModule.findUnique({
    where: { clinicId_code: { clinicId, code } },
  });
  return Boolean(row?.enabled);
}

export async function requireModule(clinicId: string, code: ModuleCode) {
  const enabled = await isModuleEnabled(clinicId, code);
  if (!enabled) {
    throw new Error(`Módulo ${code} está desativado`);
  }
}

export async function setModuleEnabled(input: {
  clinicId: string;
  code: ModuleCode;
  enabled: boolean;
  actorId?: string;
  config?: Prisma.InputJsonValue;
}) {
  await ensureModulesForClinic(input.clinicId);
  const before = await prisma.featureModule.findUnique({
    where: { clinicId_code: { clinicId: input.clinicId, code: input.code } },
  });

  const updated = await prisma.featureModule.update({
    where: { clinicId_code: { clinicId: input.clinicId, code: input.code } },
    data: {
      enabled: input.enabled,
      enabledAt: input.enabled ? new Date() : before?.enabledAt,
      disabledAt: input.enabled ? null : new Date(),
      config: input.config ?? undefined,
    },
  });

  if (input.config != null) {
    await prisma.moduleConfiguration.upsert({
      where: {
        featureModuleId_key: {
          featureModuleId: updated.id,
          key: "default",
        },
      },
      create: {
        clinicId: input.clinicId,
        featureModuleId: updated.id,
        key: "default",
        value: input.config,
      },
      update: { value: input.config },
    });
  }

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "MODULE_TOGGLE",
    entityType: "FeatureModule",
    entityId: updated.id,
    beforeData: before ? { enabled: before.enabled, code: before.code } : undefined,
    afterData: { enabled: updated.enabled, code: updated.code },
  });

  return updated;
}

export async function getModuleConfig(clinicId: string, code: ModuleCode, key = "default") {
  const mod = await prisma.featureModule.findUnique({
    where: { clinicId_code: { clinicId, code } },
  });
  if (!mod) return null;
  const row = await prisma.moduleConfiguration.findUnique({
    where: { featureModuleId_key: { featureModuleId: mod.id, key } },
  });
  return (row?.value as Record<string, unknown> | null) ?? (mod.config as Record<string, unknown> | null);
}

export async function setModuleConfig(input: {
  clinicId: string;
  code: ModuleCode;
  key: string;
  value: Prisma.InputJsonValue;
  actorId?: string;
}) {
  await ensureModulesForClinic(input.clinicId);
  const mod = await prisma.featureModule.findUnique({
    where: { clinicId_code: { clinicId: input.clinicId, code: input.code } },
  });
  if (!mod) throw new Error("Módulo não encontrado");

  const row = await prisma.moduleConfiguration.upsert({
    where: {
      featureModuleId_key: { featureModuleId: mod.id, key: input.key },
    },
    create: {
      clinicId: input.clinicId,
      featureModuleId: mod.id,
      key: input.key,
      value: input.value,
    },
    update: { value: input.value },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "MODULE_TOGGLE",
    entityType: "ModuleConfiguration",
    entityId: row.id,
    afterData: { code: input.code, key: input.key },
  });

  return row;
}

export async function listModules(clinicId: string) {
  await ensureModulesForClinic(clinicId);
  const rows = await prisma.featureModule.findMany({
    where: { clinicId },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => {
    const meta = MODULE_CATALOG.find((m) => m.code === row.code);
    return {
      ...row,
      name: meta?.name ?? row.code,
      description: meta?.description ?? "",
      core: Boolean(meta?.core),
    };
  });
}
