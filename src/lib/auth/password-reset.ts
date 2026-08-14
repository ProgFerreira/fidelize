import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import {
  buscarOrganizacaoPorSlug,
  organizacaoOperante,
} from "@/lib/organization";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

export const novaSenhaSchema = z
  .object({
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .max(72, "A senha deve ter no máximo 72 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const emailSchema = z
  .string()
  .trim()
  .email("E-mail inválido")
  .max(180)
  .transform((v) => v.toLowerCase());

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function mensagemGenerica() {
  return {
    ok: true as const,
    message:
      "Se o e-mail estiver cadastrado, você receberá um link em instantes.",
  };
}

async function checkResetRateLimit(ip: string | null) {
  if (!ip) return;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const attempts = await semOrganizacao(() =>
    prisma.auditLog.count({
      where: {
        action: "OTHER",
        entityType: "PasswordReset",
        ipAddress: ip,
        createdAt: { gte: since },
      },
    }),
  );
  if (attempts >= RATE_LIMIT_MAX) {
    throw new Error("TOO_MANY_ATTEMPTS");
  }
}

async function logReset(input: {
  organizationId?: string | null;
  clinicId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  kind: "password_reset.request" | "password_reset.complete";
  entityId?: string;
}) {
  const write = () =>
    writeAuditLog({
      organizationId: input.organizationId,
      clinicId: input.clinicId,
      userId: input.userId,
      action: "OTHER",
      entityType: "PasswordReset",
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      metadata: { kind: input.kind },
    });

  if (input.organizationId) {
    await comOrganizacao({ organizationId: input.organizationId }, write);
  } else {
    await semOrganizacao(write);
  }
}

export async function requestPasswordReset(input: {
  email: string;
  organizationSlug?: string | null;
  hostTipo: "organizacao" | "plataforma" | "indefinido";
  origin: string;
  ip: string | null;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = emailSchema.safeParse(input.email);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "E-mail inválido",
    };
  }
  const email = parsed.data;

  let organizationSlug = "";
  if (input.hostTipo === "organizacao") {
    organizationSlug = String(input.organizationSlug ?? "")
      .trim()
      .toLowerCase();
    if (!organizationSlug) {
      return { ok: false, error: "Organização não identificada." };
    }
  } else if (input.hostTipo === "indefinido") {
    organizationSlug = String(input.organizationSlug ?? "")
      .trim()
      .toLowerCase();
    if (!organizationSlug) {
      return { ok: false, error: "Informe o slug da organização." };
    }
  }

  try {
    await checkResetRateLimit(input.ip);
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_ATTEMPTS") {
      return {
        ok: false,
        error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      };
    }
    throw error;
  }

  await logReset({
    ipAddress: input.ip,
    kind: "password_reset.request",
  });

  const org = organizationSlug
    ? await buscarOrganizacaoPorSlug(organizationSlug)
    : null;

  if (organizationSlug) {
    if (!org || !organizacaoOperante(org)) {
      return mensagemGenerica();
    }
  }

  const user = await semOrganizacao(() =>
    prisma.user.findFirst({
      where: {
        email,
        organizationId: org ? org.id : null,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        clinicId: true,
        organizationId: true,
      },
    }),
  );

  if (!user) {
    return mensagemGenerica();
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const resetExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const persist = async () => {
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { resetToken: tokenHash, resetExpiresAt },
    });
  };

  if (user.organizationId) {
    await comOrganizacao({ organizationId: user.organizationId }, persist);
  } else {
    await semOrganizacao(persist);
  }

  const origin = input.origin.replace(/\/$/, "");
  const link = `${origin}/redefinir-senha?token=${rawToken}`;
  const result = await sendTransactionalEmail({
    to: user.email,
    subject: "Redefinir senha — Fidelize",
    text: [
      `Olá, ${user.name}.`,
      "",
      "Recebemos um pedido para redefinir a senha da sua conta no Fidelize.",
      "",
      "Abra o link abaixo em até 1 hora:",
      link,
      "",
      "Se você não pediu isso, ignore este e-mail.",
    ].join("\n"),
  });

  if (!result.ok && process.env.NODE_ENV === "development") {
    console.error("[password-reset] falha no envio", result.error);
  }

  return mensagemGenerica();
}

export async function isPasswordResetTokenValid(rawToken: string): Promise<boolean> {
  const token = rawToken.trim();
  if (!token || token.length > 128) return false;
  const tokenHash = hashToken(token);
  const row = await semOrganizacao(() =>
    prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetExpiresAt: { gt: new Date() },
        status: "ACTIVE",
      },
      select: { id: true },
    }),
  );
  return Boolean(row);
}

export async function confirmPasswordReset(input: {
  token: string;
  password: string;
  confirmPassword: string;
  ip: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = novaSenhaSchema.safeParse({
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const token = input.token.trim();
  if (!token || token.length > 128) {
    return {
      ok: false,
      error: "Este link é inválido ou expirou. Solicite um novo.",
    };
  }

  const tokenHash = hashToken(token);
  const user = await semOrganizacao(() =>
    prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetExpiresAt: { gt: new Date() },
        status: "ACTIVE",
      },
      select: {
        id: true,
        clinicId: true,
        organizationId: true,
      },
    }),
  );

  if (!user) {
    return {
      ok: false,
      error: "Este link é inválido ou expirou. Solicite um novo.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const persist = async () => {
    const updated = await prisma.user.updateMany({
      where: {
        id: user.id,
        resetToken: tokenHash,
        resetExpiresAt: { gt: new Date() },
        status: "ACTIVE",
      },
      data: {
        passwordHash,
        resetToken: null,
        resetExpiresAt: null,
      },
    });
    return updated.count;
  };

  const count = user.organizationId
    ? await comOrganizacao({ organizationId: user.organizationId }, persist)
    : await semOrganizacao(persist);

  if (count !== 1) {
    return {
      ok: false,
      error: "Este link é inválido ou expirou. Solicite um novo.",
    };
  }

  await logReset({
    organizationId: user.organizationId,
    clinicId: user.clinicId,
    userId: user.id,
    ipAddress: input.ip,
    kind: "password_reset.complete",
    entityId: user.id,
  });

  return { ok: true };
}
