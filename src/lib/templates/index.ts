import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import type {
  CommunicationChannel,
  TemplateApprovalStatus,
} from "@/generated/prisma/client";

const FORBIDDEN_VARS = [
  "cpf",
  "password",
  "senha",
  "diagnostico",
  "prontuario",
  "token",
];

export const SAFE_VARIABLES = [
  "nome_paciente",
  "nome_clinica",
  "unidade",
  "saldo",
  "pontos",
  "categoria",
  "validade",
  "nome_campanha",
  "nome_voucher",
  "link_portal",
  "link_indicacao",
  "link_pesquisa",
  "telefone_clinica",
] as const;

export const templateSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(120),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "PUSH", "INTERNAL"]),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(5000),
  language: z.string().default("pt-BR"),
  footerOptOut: z.boolean().default(true),
});

export function extractVariables(body: string) {
  const matches = body.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi);
  return [...new Set([...matches].map((m) => m[1].toLowerCase()))];
}

export function validateTemplateBody(body: string) {
  const vars = extractVariables(body);
  const forbidden = vars.filter((v) => FORBIDDEN_VARS.some((f) => v.includes(f)));
  if (forbidden.length) {
    throw new Error(
      `Variáveis sensíveis não permitidas: ${forbidden.join(", ")}`,
    );
  }
  const unknown = vars.filter(
    (v) => !(SAFE_VARIABLES as readonly string[]).includes(v),
  );
  if (unknown.length) {
    throw new Error(`Variáveis desconhecidas: ${unknown.join(", ")}`);
  }
  return vars;
}

export function renderTemplate(
  body: string,
  values: Record<string, string | number | null | undefined>,
) {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const val = values[key.toLowerCase()];
    return val == null ? "" : String(val);
  });
}

export async function createTemplate(input: {
  clinicId: string;
  actorId?: string;
  data: z.infer<typeof templateSchema>;
}) {
  const data = templateSchema.parse(input.data);
  const variables = validateTemplateBody(data.body);

  const latest = await prisma.messageTemplate.findFirst({
    where: {
      clinicId: input.clinicId,
      code: data.code,
      channel: data.channel as CommunicationChannel,
    },
    orderBy: { version: "desc" },
  });

  const template = await prisma.messageTemplate.create({
    data: {
      clinicId: input.clinicId,
      code: data.code,
      name: data.name,
      channel: data.channel as CommunicationChannel,
      subject: data.subject ?? null,
      body: data.body,
      language: data.language,
      footerOptOut: data.footerOptOut,
      variables,
      version: (latest?.version ?? 0) + 1,
      approvalStatus: "DRAFT",
    },
  });

  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "TEMPLATE_CHANGE",
    entityType: "MessageTemplate",
    entityId: template.id,
    afterData: { code: template.code, version: template.version },
  });

  return template;
}

export async function approveTemplate(input: {
  clinicId: string;
  templateId: string;
  actorId: string;
  status: Extract<TemplateApprovalStatus, "APPROVED" | "REJECTED">;
}) {
  const template = await prisma.messageTemplate.update({
    where: { id: input.templateId },
    data: {
      approvalStatus: input.status,
      approvedAt: input.status === "APPROVED" ? new Date() : null,
      approvedBy: input.actorId,
      active: input.status === "APPROVED",
    },
  });
  if (template.clinicId !== input.clinicId) {
    throw new Error("Template de outra clínica");
  }
  await writeAuditLog({
    clinicId: input.clinicId,
    userId: input.actorId,
    action: "TEMPLATE_CHANGE",
    entityType: "MessageTemplate",
    entityId: template.id,
    afterData: { approvalStatus: template.approvalStatus },
  });
  return template;
}

export async function listTemplates(clinicId: string) {
  return prisma.messageTemplate.findMany({
    where: { clinicId },
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });
}

export async function migrateLegacyTemplates(clinicId: string) {
  const legacy = await prisma.notificationTemplate.findMany({
    where: { clinicId },
  });
  for (const item of legacy) {
    const channel = (
      ["WHATSAPP", "EMAIL", "SMS", "PUSH", "INTERNAL"].includes(item.channel)
        ? item.channel
        : "INTERNAL"
    ) as CommunicationChannel;
    await prisma.messageTemplate.upsert({
      where: {
        clinicId_code_channel_version: {
          clinicId,
          code: item.code,
          channel,
          version: 1,
        },
      },
      create: {
        clinicId,
        code: item.code,
        name: item.code,
        channel,
        subject: item.subject,
        body: item.body,
        approvalStatus: item.active ? "APPROVED" : "DRAFT",
        active: item.active,
        variables: extractVariables(item.body),
      },
      update: {},
    });
  }
}
