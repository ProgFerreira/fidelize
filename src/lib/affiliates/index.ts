import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { money, moneyToString, percentOf } from "@/lib/money";
import { hashPassword } from "@/lib/auth/password";
import { applyPlanToOrganization } from "@/lib/billing/enforce";
import { normalizePlanCode, type PlanCode } from "@/lib/billing/plans";
import { semOrganizacao, comOrganizacao } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";
import {
  AFFILIATE_COOKIE,
  encodeAffCookie,
  decodeAffCookie,
  type AffCookiePayload,
} from "@/lib/affiliates/cookie";
import type {
  AffiliateCommissionStatus,
  AffiliateCommissionType,
  AffiliateStatus,
  AffiliateType,
  Prisma,
} from "@/generated/prisma/client";

export {
  AFFILIATE_COOKIE,
  encodeAffCookie,
  decodeAffCookie,
  type AffCookiePayload,
} from "@/lib/affiliates/cookie";

export const DEFAULT_PLAN_ID = "aff_plan_default_10";
export const TERMS_VERSION = "2026-08-v1";

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateAffiliateCode(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function ensureDefaultCommissionPlan() {
  return semOrganizacao(() =>
    prisma.affiliateCommissionPlan.upsert({
      where: { id: DEFAULT_PLAN_ID },
      create: {
        id: DEFAULT_PLAN_ID,
        name: "Padrão 10% primeira compra",
        commissionType: "PERCENT",
        commissionValue: "10",
        active: true,
        holdDays: 14,
        attributionDays: 30,
        firstPurchaseOnly: true,
        eligiblePlanCodes: ["start", "pro", "vip"],
      },
      update: {},
    }),
  );
}

export async function ensureAffiliateRole() {
  return semOrganizacao(async () => {
    const existing = await prisma.role.findFirst({
      where: { code: "AFFILIATE", organizationId: null, clinicId: null },
    });
    if (existing) return existing;
    return prisma.role.create({
      data: {
        organizationId: null,
        clinicId: null,
        code: "AFFILIATE",
        name: "Afiliado / Parceiro",
        isSystem: true,
      },
    });
  });
}

export async function writeAffiliateAudit(input: {
  action: string;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return semOrganizacao(() =>
    prisma.affiliateAuditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeData: input.beforeData,
        afterData: input.afterData,
        reason: input.reason ?? null,
        metadata: input.metadata,
      },
    }),
  );
}

export const createAffiliateSchema = z.object({
  type: z.enum(["AFFILIATE", "PARTNER"]).default("AFFILIATE"),
  name: z.string().trim().min(2).max(160),
  document: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().nullable(),
  pixKey: z.string().trim().max(120).optional().nullable(),
  commissionPlanId: z.string().optional(),
  customCommissionType: z.enum(["PERCENT", "FIXED"]).optional().nullable(),
  customCommissionValue: z.coerce.number().min(0).optional().nullable(),
  password: z.string().min(8).max(72).optional(),
  termsAccepted: z.boolean().optional(),
});

export async function createAffiliate(input: {
  data: z.infer<typeof createAffiliateSchema>;
  actorId?: string;
}) {
  const data = createAffiliateSchema.parse(input.data);
  await ensureDefaultCommissionPlan();
  const role = await ensureAffiliateRole();
  const planId = data.commissionPlanId || DEFAULT_PLAN_ID;

  let code = generateAffiliateCode();
  for (let i = 0; i < 5; i++) {
    const clash = await semOrganizacao(() =>
      prisma.affiliate.findUnique({ where: { code }, select: { id: true } }),
    );
    if (!clash) break;
    code = generateAffiliateCode();
  }

  const password = data.password || `Aff@${randomBytes(5).toString("hex")}A1`;
  const passwordHash = await hashPassword(password);

  const result = await semOrganizacao(async () => {
    const user = await prisma.user.create({
      data: {
        organizationId: null,
        clinicId: null,
        roleId: role.id,
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        passwordHash,
        status: "ACTIVE",
      },
    });

    const affiliate = await prisma.affiliate.create({
      data: {
        code,
        type: data.type as AffiliateType,
        status: "PENDING",
        name: data.name,
        document: data.document || null,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        userId: user.id,
        commissionPlanId: planId,
        customCommissionType: (data.customCommissionType as AffiliateCommissionType) || null,
        customCommissionValue:
          data.customCommissionValue != null
            ? moneyToString(data.customCommissionValue)
            : null,
        pixKey: data.pixKey || null,
        termsAcceptedAt: data.termsAccepted ? new Date() : null,
        termsVersion: data.termsAccepted ? TERMS_VERSION : null,
      },
      include: { commissionPlan: true },
    });

    return { affiliate, temporaryPassword: password };
  });

  await writeAffiliateAudit({
    action: "AFFILIATE_CREATE",
    actorUserId: input.actorId,
    entityType: "Affiliate",
    entityId: result.affiliate.id,
    afterData: { code: result.affiliate.code, status: result.affiliate.status },
  });

  return result;
}

export async function updateAffiliateStatus(input: {
  affiliateId: string;
  status: AffiliateStatus;
  actorId: string;
  reason?: string;
}) {
  const before = await semOrganizacao(() =>
    prisma.affiliate.findUniqueOrThrow({ where: { id: input.affiliateId } }),
  );

  const data: Prisma.AffiliateUpdateInput = {
    status: input.status,
  };
  if (input.status === "ACTIVE") {
    data.approvedAt = new Date();
    data.approvedByUserId = input.actorId;
  }

  const after = await semOrganizacao(() =>
    prisma.affiliate.update({
      where: { id: input.affiliateId },
      data,
    }),
  );

  const actionMap: Record<string, string> = {
    ACTIVE: "AFFILIATE_APPROVE",
    REJECTED: "AFFILIATE_REJECT",
    SUSPENDED: "AFFILIATE_SUSPEND",
    BLOCKED: "AFFILIATE_BLOCK",
    PENDING: "AFFILIATE_REACTIVATE",
  };

  await writeAffiliateAudit({
    action: actionMap[input.status] || "AFFILIATE_STATUS",
    actorUserId: input.actorId,
    entityType: "Affiliate",
    entityId: input.affiliateId,
    beforeData: { status: before.status },
    afterData: { status: after.status },
    reason: input.reason,
  });

  await writeAuditLog({
    userId: input.actorId,
    action:
      input.status === "ACTIVE"
        ? "AFFILIATE_APPROVE"
        : input.status === "REJECTED"
          ? "AFFILIATE_REJECT"
          : input.status === "SUSPENDED"
            ? "AFFILIATE_SUSPEND"
            : input.status === "BLOCKED"
              ? "AFFILIATE_BLOCK"
              : "AFFILIATE_REACTIVATE",
    entityType: "Affiliate",
    entityId: input.affiliateId,
    beforeData: { status: before.status },
    afterData: { status: after.status },
    metadata: { reason: input.reason ?? null },
  });

  return after;
}

export async function trackAffiliateVisit(input: {
  code: string;
  landingPath?: string | null;
  referer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  visitToken?: string | null;
}) {
  const code = input.code.trim().toLowerCase();
  const affiliate = await semOrganizacao(() =>
    prisma.affiliate.findUnique({
      where: { code },
      include: { commissionPlan: true },
    }),
  );

  if (!affiliate || affiliate.status !== "ACTIVE") {
    return { ok: false as const, reason: "invalid_or_inactive" as const };
  }

  const attributionDays = affiliate.commissionPlan.attributionDays || 30;
  const visitToken = input.visitToken || randomBytes(16).toString("hex");
  const expiresAt = addDays(new Date(), attributionDays);

  const visit = await semOrganizacao(() =>
    prisma.affiliateVisit.create({
      data: {
        affiliateId: affiliate.id,
        code: affiliate.code,
        visitToken,
        landingPath: input.landingPath?.slice(0, 500) || null,
        referer: input.referer?.slice(0, 2000) || null,
        utmSource: input.utmSource?.slice(0, 120) || null,
        utmMedium: input.utmMedium?.slice(0, 120) || null,
        utmCampaign: input.utmCampaign?.slice(0, 120) || null,
        ipHash: hashIp(input.ip),
        userAgent: input.userAgent?.slice(0, 500) || null,
        expiresAt,
      },
    }),
  );

  const cookie: AffCookiePayload = {
    code: affiliate.code,
    visitToken,
    visitId: visit.id,
    utmSource: input.utmSource || undefined,
    utmMedium: input.utmMedium || undefined,
    utmCampaign: input.utmCampaign || undefined,
    landingPath: input.landingPath || undefined,
    exp: expiresAt.getTime(),
  };

  return {
    ok: true as const,
    affiliateId: affiliate.id,
    visitId: visit.id,
    attributionDays,
    cookie,
    cookieValue: encodeAffCookie(cookie),
    maxAgeSeconds: attributionDays * 24 * 60 * 60,
  };
}

export async function getActiveReferral(organizationId: string) {
  return semOrganizacao(() =>
    prisma.affiliateReferral.findFirst({
      where: { organizationId, active: true },
      include: { affiliate: { include: { commissionPlan: true } } },
    }),
  );
}

export async function linkReferralToOrganization(input: {
  organizationId: string;
  affiliateId?: string;
  affiliateCode?: string;
  visitId?: string | null;
  source: "COOKIE" | "MANUAL" | "ADMIN";
  actorId?: string | null;
  reason?: string | null;
}) {
  const affiliate = await semOrganizacao(() =>
    input.affiliateId
      ? prisma.affiliate.findUnique({ where: { id: input.affiliateId } })
      : prisma.affiliate.findUnique({
          where: { code: (input.affiliateCode || "").trim().toLowerCase() },
        }),
  );

  if (!affiliate) throw new Error("Afiliado não encontrado");
  if (affiliate.status !== "ACTIVE") {
    throw new Error("Afiliado não está ativo");
  }

  const org = await semOrganizacao(() =>
    prisma.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    }),
  );

  const fraud = detectSelfReferral({
    affiliateEmail: affiliate.email,
    affiliateDocument: affiliate.document,
    orgEmail: org.contactEmail,
    orgDocument: org.document,
  });

  const existing = await getActiveReferral(input.organizationId);

  if (existing && !input.actorId) {
    return existing;
  }

  if (existing && existing.affiliateId === affiliate.id) {
    return existing;
  }

  if (existing && input.source !== "ADMIN" && input.source !== "MANUAL") {
    return existing;
  }

  if (existing && (!input.reason || input.reason.trim().length < 5)) {
    throw new Error("Justificativa obrigatória para alterar indicação");
  }

  const referral = await semOrganizacao(async () => {
    if (existing) {
      await prisma.affiliateReferral.update({
        where: { id: existing.id },
        data: { active: false, activeOrganizationKey: null },
      });
    }

    return prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        organizationId: input.organizationId,
        visitId: input.visitId || null,
        source: input.source,
        active: true,
        activeOrganizationKey: input.organizationId,
        linkedByUserId: input.actorId || null,
        linkReason: input.reason || null,
        previousAffiliateId: existing?.affiliateId || null,
      },
      include: { affiliate: true },
    });
  });

  await writeAffiliateAudit({
    action: "AFFILIATE_REFERRAL_LINK",
    actorUserId: input.actorId,
    entityType: "AffiliateReferral",
    entityId: referral.id,
    beforeData: existing
      ? { affiliateId: existing.affiliateId, organizationId: existing.organizationId }
      : undefined,
    afterData: {
      affiliateId: referral.affiliateId,
      organizationId: referral.organizationId,
      fraud,
    },
    reason: input.reason,
  });

  if (input.actorId) {
    await writeAuditLog({
      userId: input.actorId,
      action: "AFFILIATE_REFERRAL_LINK",
      entityType: "AffiliateReferral",
      entityId: referral.id,
      metadata: {
        organizationId: input.organizationId,
        affiliateId: affiliate.id,
        previousAffiliateId: existing?.affiliateId ?? null,
        reason: input.reason ?? null,
      },
    });
  }

  return referral;
}

export function detectSelfReferral(input: {
  affiliateEmail: string;
  affiliateDocument?: string | null;
  orgEmail?: string | null;
  orgDocument?: string | null;
}) {
  const flags: string[] = [];
  const aEmail = input.affiliateEmail.trim().toLowerCase();
  const oEmail = input.orgEmail?.trim().toLowerCase();
  if (oEmail && aEmail === oEmail) flags.push("same_email");

  const aDoc = (input.affiliateDocument || "").replace(/\D/g, "");
  const oDoc = (input.orgDocument || "").replace(/\D/g, "");
  if (aDoc && oDoc && aDoc === oDoc) flags.push("same_document");

  return flags;
}

function resolveCommissionRule(affiliate: {
  customCommissionType: AffiliateCommissionType | null;
  customCommissionValue: Prisma.Decimal | null;
  commissionPlan: {
    id: string;
    name: string;
    commissionType: AffiliateCommissionType;
    commissionValue: Prisma.Decimal;
    holdDays: number;
    firstPurchaseOnly: boolean;
    eligiblePlanCodes: Prisma.JsonValue;
  };
}) {
  const type =
    affiliate.customCommissionType || affiliate.commissionPlan.commissionType;
  const value = money(
    affiliate.customCommissionValue ?? affiliate.commissionPlan.commissionValue,
  );
  return {
    planId: affiliate.commissionPlan.id,
    planName: affiliate.commissionPlan.name,
    commissionType: type,
    commissionValue: moneyToString(value),
    holdDays: affiliate.commissionPlan.holdDays,
    firstPurchaseOnly: affiliate.commissionPlan.firstPurchaseOnly,
    eligiblePlanCodes: affiliate.commissionPlan.eligiblePlanCodes,
  };
}

export function calculateCommissionAmount(input: {
  netAmount: Prisma.Decimal | string | number;
  commissionType: AffiliateCommissionType;
  commissionValue: Prisma.Decimal | string | number;
}) {
  const base = money(input.netAmount);
  if (input.commissionType === "FIXED") {
    return money(input.commissionValue).toDecimalPlaces(4);
  }
  return percentOf(base, input.commissionValue);
}

export async function confirmPlatformSale(input: {
  organizationId: string;
  planCode: string;
  grossAmount: number | string;
  discountAmount?: number | string;
  idempotencyKey: string;
  actorId: string;
  notes?: string | null;
  applyPlan?: boolean;
}) {
  const planCode = normalizePlanCode(input.planCode);
  const gross = money(input.grossAmount);
  const discount = money(input.discountAmount ?? 0);
  const net = gross.minus(discount);
  if (net.lt(0)) throw new Error("Valor líquido inválido");

  const existing = await semOrganizacao(() =>
    prisma.platformSale.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { commissions: true },
    }),
  );
  if (existing) {
    return { sale: existing, commission: existing.commissions[0] ?? null, duplicated: true };
  }

  const result = await semOrganizacao(async () => {
    const sale = await prisma.platformSale.create({
      data: {
        organizationId: input.organizationId,
        planCode,
        grossAmount: moneyToString(gross),
        discountAmount: moneyToString(discount),
        netAmount: moneyToString(net),
        status: "CONFIRMED",
        idempotencyKey: input.idempotencyKey,
        notes: input.notes || null,
        confirmedAt: new Date(),
        confirmedByUserId: input.actorId,
      },
    });
    return sale;
  });

  if (input.applyPlan !== false && planCode !== "trial") {
    await comOrganizacao({ organizationId: input.organizationId }, async () => {
      await applyPlanToOrganization({
        organizationId: input.organizationId,
        plan: planCode as PlanCode,
        actorId: input.actorId,
      });
    });
  }

  const commission = await createCommissionForSale({
    saleId: result.id,
    actorId: input.actorId,
  });

  await writeAffiliateAudit({
    action: "PLATFORM_SALE_CONFIRM",
    actorUserId: input.actorId,
    entityType: "PlatformSale",
    entityId: result.id,
    afterData: {
      organizationId: input.organizationId,
      planCode,
      netAmount: moneyToString(net),
      commissionId: commission?.id ?? null,
    },
  });

  await writeAuditLog({
    userId: input.actorId,
    action: "PLATFORM_SALE_CONFIRM",
    entityType: "PlatformSale",
    entityId: result.id,
    afterData: {
      organizationId: input.organizationId,
      planCode,
      netAmount: moneyToString(net),
    },
  });

  return { sale: result, commission, duplicated: false };
}

export async function createCommissionForSale(input: {
  saleId: string;
  actorId?: string;
}) {
  const sale = await semOrganizacao(() =>
    prisma.platformSale.findUniqueOrThrow({
      where: { id: input.saleId },
      include: {
        organization: true,
        commissions: { where: { kind: "PRIMARY" } },
      },
    }),
  );

  if (sale.status !== "CONFIRMED") return null;
  if (sale.commissions.length > 0) return sale.commissions[0]!;

  const referral = await getActiveReferral(sale.organizationId);
  if (!referral) return null;

  const affiliate = await semOrganizacao(() =>
    prisma.affiliate.findUniqueOrThrow({
      where: { id: referral.affiliateId },
      include: { commissionPlan: true },
    }),
  );

  if (affiliate.status !== "ACTIVE") return null;

  const rule = resolveCommissionRule(affiliate);
  const eligible = Array.isArray(rule.eligiblePlanCodes)
    ? (rule.eligiblePlanCodes as string[])
    : null;
  if (eligible && eligible.length > 0 && !eligible.includes(sale.planCode)) {
    return null;
  }

  if (rule.firstPurchaseOnly) {
    const priorPaid = await semOrganizacao(() =>
      prisma.platformSale.count({
        where: {
          organizationId: sale.organizationId,
          status: "CONFIRMED",
          id: { not: sale.id },
          confirmedAt: { not: null },
        },
      }),
    );
    if (priorPaid > 0) return null;
  }

  const fraudFlags = detectSelfReferral({
    affiliateEmail: affiliate.email,
    affiliateDocument: affiliate.document,
    orgEmail: sale.organization.contactEmail,
    orgDocument: sale.organization.document,
  });

  const amount = calculateCommissionAmount({
    netAmount: sale.netAmount,
    commissionType: rule.commissionType,
    commissionValue: rule.commissionValue,
  });

  const status: AffiliateCommissionStatus =
    fraudFlags.length > 0 ? "BLOCKED" : "PENDING";
  const availableAt = addDays(new Date(), rule.holdDays);

  const snapshot = {
    ...rule,
    baseAmount: moneyToString(sale.netAmount),
    calculatedAmount: moneyToString(amount),
    saleId: sale.id,
    planCode: sale.planCode,
    createdAt: new Date().toISOString(),
  };

  try {
    const commission = await semOrganizacao(() =>
      prisma.affiliateCommission.create({
        data: {
          affiliateId: affiliate.id,
          referralId: referral.id,
          platformSaleId: sale.id,
          kind: "PRIMARY",
          status,
          baseAmount: moneyToString(sale.netAmount),
          amount: moneyToString(amount),
          ruleSnapshot: snapshot,
          availableAt,
          blockReason: fraudFlags.length
            ? `Autoindicação / fraude: ${fraudFlags.join(",")}`
            : null,
          fraudFlags: fraudFlags.length ? fraudFlags : undefined,
        },
      }),
    );
    return commission;
  } catch (err) {
    const existing = await semOrganizacao(() =>
      prisma.affiliateCommission.findUnique({
        where: {
          platformSaleId_kind: { platformSaleId: sale.id, kind: "PRIMARY" },
        },
      }),
    );
    if (existing) return existing;
    throw err;
  }
}

export async function cancelOrRefundPlatformSale(input: {
  saleId: string;
  actorId: string;
  reason: string;
  asRefund?: boolean;
}) {
  const sale = await semOrganizacao(() =>
    prisma.platformSale.findUniqueOrThrow({
      where: { id: input.saleId },
      include: { commissions: true },
    }),
  );

  if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
    return { sale, adjusted: false };
  }

  const newStatus = input.asRefund ? "REFUNDED" : "CANCELLED";

  const updated = await semOrganizacao(async () => {
    const s = await prisma.platformSale.update({
      where: { id: sale.id },
      data: {
        status: newStatus,
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
    });

    for (const c of sale.commissions) {
      if (c.kind !== "PRIMARY") continue;
      if (c.status === "PAID") {
        const existingAdj = await prisma.affiliateCommission.findUnique({
          where: {
            platformSaleId_kind: {
              platformSaleId: sale.id,
              kind: "ADJUSTMENT",
            },
          },
        });
        if (!existingAdj) {
          await prisma.affiliateCommission.create({
            data: {
              affiliateId: c.affiliateId,
              referralId: c.referralId,
              platformSaleId: sale.id,
              kind: "ADJUSTMENT",
              status: "AVAILABLE",
              baseAmount: moneyToString(c.baseAmount),
              amount: moneyToString(money(c.amount).neg()),
              ruleSnapshot: {
                reason: input.reason,
                originalCommissionId: c.id,
                type: "REFUND_ADJUSTMENT",
              },
              availableAt: new Date(),
              cancelReason: input.reason,
            },
          });
        }
      } else if (c.status !== "CANCELLED") {
        await prisma.affiliateCommission.update({
          where: { id: c.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: input.reason,
          },
        });
      }
    }

    return s;
  });

  await writeAffiliateAudit({
    action: "PLATFORM_SALE_CANCEL",
    actorUserId: input.actorId,
    entityType: "PlatformSale",
    entityId: sale.id,
    beforeData: { status: sale.status },
    afterData: { status: newStatus },
    reason: input.reason,
  });

  return { sale: updated, adjusted: true };
}

export async function releaseDueCommissions(input?: { limit?: number; now?: Date }) {
  const now = input?.now ?? new Date();
  const limit = input?.limit ?? 200;

  const due = await semOrganizacao(() =>
    prisma.affiliateCommission.findMany({
      where: {
        status: "PENDING",
        availableAt: { lte: now },
        platformSale: { status: "CONFIRMED" },
      },
      take: limit,
      orderBy: { availableAt: "asc" },
      select: { id: true },
    }),
  );

  let released = 0;
  for (const row of due) {
    const updated = await semOrganizacao(() =>
      prisma.affiliateCommission.updateMany({
        where: {
          id: row.id,
          status: "PENDING",
          platformSale: { status: "CONFIRMED" },
        },
        data: { status: "AVAILABLE" },
      }),
    );
    released += updated.count;
  }

  return { scanned: due.length, released };
}

export async function blockOrCancelCommission(input: {
  commissionId: string;
  actorId: string;
  action: "BLOCK" | "CANCEL";
  reason: string;
}) {
  const before = await semOrganizacao(() =>
    prisma.affiliateCommission.findUniqueOrThrow({
      where: { id: input.commissionId },
    }),
  );

  if (before.status === "PAID") {
    throw new Error("Comissão já paga — registre ajuste via estorno da venda");
  }

  const after = await semOrganizacao(() =>
    prisma.affiliateCommission.update({
      where: { id: input.commissionId },
      data:
        input.action === "BLOCK"
          ? { status: "BLOCKED", blockReason: input.reason }
          : {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelReason: input.reason,
            },
    }),
  );

  await writeAffiliateAudit({
    action:
      input.action === "BLOCK"
        ? "AFFILIATE_COMMISSION_BLOCK"
        : "AFFILIATE_COMMISSION_CANCEL",
    actorUserId: input.actorId,
    entityType: "AffiliateCommission",
    entityId: input.commissionId,
    beforeData: { status: before.status },
    afterData: { status: after.status },
    reason: input.reason,
  });

  return after;
}

export async function createAffiliatePayout(input: {
  affiliateId: string;
  commissionIds: string[];
  actorId: string;
  method?: string;
  notes?: string | null;
  receiptPath?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) {
  if (!input.commissionIds.length) {
    throw new Error("Selecione ao menos uma comissão");
  }

  return semOrganizacao(async () => {
    const affiliate = await prisma.affiliate.findUniqueOrThrow({
      where: { id: input.affiliateId },
    });

    const commissions = await prisma.affiliateCommission.findMany({
      where: { id: { in: input.commissionIds } },
    });

    if (commissions.length !== input.commissionIds.length) {
      throw new Error("Comissão inválida");
    }

    for (const c of commissions) {
      if (c.affiliateId !== input.affiliateId) {
        throw new Error("Comissão pertence a outro afiliado");
      }
      if (c.status !== "AVAILABLE") {
        throw new Error("Apenas comissões disponíveis podem ser pagas");
      }
    }

    const total = commissions.reduce(
      (acc, c) => acc.plus(money(c.amount)),
      money(0),
    );

    const payout = await prisma.$transaction(async (tx) => {
      const p = await tx.affiliatePayout.create({
        data: {
          affiliateId: input.affiliateId,
          periodStart: input.periodStart || null,
          periodEnd: input.periodEnd || null,
          totalAmount: moneyToString(total),
          status: "PAID",
          method: input.method || "pix",
          payoutKeyUsed: affiliate.pixKey,
          paidAt: new Date(),
          paidByUserId: input.actorId,
          notes: input.notes || null,
          receiptPath: input.receiptPath || null,
        },
      });

      for (const c of commissions) {
        await tx.affiliatePayoutItem.create({
          data: {
            payoutId: p.id,
            commissionId: c.id,
            amount: moneyToString(c.amount),
          },
        });
        await tx.affiliateCommission.update({
          where: { id: c.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      }

      return p;
    });

    await writeAffiliateAudit({
      action: "AFFILIATE_PAYOUT",
      actorUserId: input.actorId,
      entityType: "AffiliatePayout",
      entityId: payout.id,
      afterData: {
        affiliateId: input.affiliateId,
        totalAmount: moneyToString(total),
        commissionIds: input.commissionIds,
      },
    });

    await writeAuditLog({
      userId: input.actorId,
      action: "AFFILIATE_PAYOUT",
      entityType: "AffiliatePayout",
      entityId: payout.id,
      afterData: { totalAmount: moneyToString(total) },
    });

    return payout;
  });
}

export async function updateAffiliateProfile(input: {
  affiliateId: string;
  actorId: string;
  data: {
    name?: string;
    phone?: string | null;
    pixKey?: string | null;
    payoutNotes?: string | null;
  };
  isAdmin?: boolean;
}) {
  const before = await semOrganizacao(() =>
    prisma.affiliate.findUniqueOrThrow({ where: { id: input.affiliateId } }),
  );

  const after = await semOrganizacao(() =>
    prisma.affiliate.update({
      where: { id: input.affiliateId },
      data: {
        name: input.data.name?.trim() || undefined,
        phone: input.data.phone === undefined ? undefined : input.data.phone,
        pixKey: input.data.pixKey === undefined ? undefined : input.data.pixKey,
        payoutNotes:
          input.data.payoutNotes === undefined
            ? undefined
            : input.data.payoutNotes,
      },
    }),
  );

  await writeAffiliateAudit({
    action: "AFFILIATE_PROFILE_CHANGE",
    actorUserId: input.actorId,
    entityType: "Affiliate",
    entityId: input.affiliateId,
    beforeData: {
      name: before.name,
      phone: before.phone,
      pixKey: before.pixKey ? "***" : null,
    },
    afterData: {
      name: after.name,
      phone: after.phone,
      pixKey: after.pixKey ? "***" : null,
    },
  });

  return after;
}

export function maskOrgName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const s = parts[0]!;
    return s.length <= 2 ? `${s[0]}*` : `${s.slice(0, 2)}***`;
  }
  return `${parts[0]} ${parts[1]![0]}***`;
}

export async function getAffiliateDashboardMetrics(affiliateId: string) {
  return semOrganizacao(async () => {
    const [visits, referrals, commissions, payouts] = await Promise.all([
      prisma.affiliateVisit.count({ where: { affiliateId } }),
      prisma.affiliateReferral.count({ where: { affiliateId } }),
      prisma.affiliateCommission.findMany({
        where: { affiliateId },
        select: { status: true, amount: true, kind: true },
      }),
      prisma.affiliatePayout.findMany({
        where: { affiliateId, status: "PAID" },
        select: { totalAmount: true },
      }),
    ]);

    const confirmedSales = await prisma.affiliateCommission.count({
      where: {
        affiliateId,
        kind: "PRIMARY",
        status: { in: ["PENDING", "APPROVED", "AVAILABLE", "PAID"] },
      },
    });

    let pending = money(0);
    let available = money(0);
    let paid = money(0);

    for (const c of commissions) {
      const amt = money(c.amount);
      if (c.status === "PENDING" || c.status === "APPROVED") pending = pending.plus(amt);
      if (c.status === "AVAILABLE") available = available.plus(amt);
      if (c.status === "PAID") paid = paid.plus(amt);
    }

    const paidFromPayouts = payouts.reduce(
      (a, p) => a.plus(money(p.totalAmount)),
      money(0),
    );

    const conversion =
      visits > 0 ? Number(((referrals / visits) * 100).toFixed(2)) : 0;

    return {
      visits,
      referrals,
      confirmedSales,
      conversionRate: conversion,
      pendingAmount: moneyToString(pending, 2),
      availableAmount: moneyToString(available, 2),
      paidAmount: moneyToString(paidFromPayouts.gt(0) ? paidFromPayouts : paid, 2),
    };
  });
}

export async function getAdminAffiliateMetrics() {
  return semOrganizacao(async () => {
    const [
      activeAffiliates,
      visits,
      referrals,
      commissions,
    ] = await Promise.all([
      prisma.affiliate.count({ where: { status: "ACTIVE" } }),
      prisma.affiliateVisit.count(),
      prisma.affiliateReferral.count(),
      prisma.affiliateCommission.findMany({
        where: { kind: "PRIMARY" },
        select: { status: true, amount: true, baseAmount: true },
      }),
    ]);

    let pending = money(0);
    let available = money(0);
    let paid = money(0);
    let revenue = money(0);
    let confirmedSales = 0;

    for (const c of commissions) {
      if (["CANCELLED", "BLOCKED"].includes(c.status)) continue;
      confirmedSales += 1;
      revenue = revenue.plus(money(c.baseAmount));
      const amt = money(c.amount);
      if (c.status === "PENDING" || c.status === "APPROVED") pending = pending.plus(amt);
      if (c.status === "AVAILABLE") available = available.plus(amt);
      if (c.status === "PAID") paid = paid.plus(amt);
    }

    return {
      activeAffiliates,
      visits,
      referrals,
      confirmedSales,
      attributedRevenue: moneyToString(revenue, 2),
      pendingCommissions: moneyToString(pending, 2),
      availableCommissions: moneyToString(available, 2),
      paidCommissions: moneyToString(paid, 2),
      conversionRate:
        visits > 0 ? Number(((referrals / visits) * 100).toFixed(2)) : 0,
    };
  });
}

export async function updateAffiliateCommissionPlan(input: {
  affiliateId: string;
  commissionPlanId: string;
  actorId: string;
  reason?: string;
}) {
  const before = await semOrganizacao(() =>
    prisma.affiliate.findUniqueOrThrow({ where: { id: input.affiliateId } }),
  );
  const after = await semOrganizacao(() =>
    prisma.affiliate.update({
      where: { id: input.affiliateId },
      data: { commissionPlanId: input.commissionPlanId },
    }),
  );
  await writeAffiliateAudit({
    action: "AFFILIATE_PLAN_CHANGE",
    actorUserId: input.actorId,
    entityType: "Affiliate",
    entityId: input.affiliateId,
    beforeData: { commissionPlanId: before.commissionPlanId },
    afterData: { commissionPlanId: after.commissionPlanId },
    reason: input.reason,
  });
  await writeAuditLog({
    userId: input.actorId,
    action: "AFFILIATE_PLAN_CHANGE",
    entityType: "Affiliate",
    entityId: input.affiliateId,
    beforeData: { commissionPlanId: before.commissionPlanId },
    afterData: { commissionPlanId: after.commissionPlanId },
  });
  return after;
}

export async function listAffiliates(filters?: {
  status?: AffiliateStatus;
  type?: AffiliateType;
  q?: string;
}) {
  const status = filters?.status || undefined;
  const type = filters?.type || undefined;
  const q = filters?.q?.trim() || undefined;

  return semOrganizacao(() =>
    prisma.affiliate.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { code: { contains: q } },
                { document: { contains: q } },
              ],
            }
          : {}),
      },
      include: { commissionPlan: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
}

/** Helpers exportados para testes unitários sem DB. */
export const __test = {
  calculateCommissionAmount,
  detectSelfReferral,
  encodeAffCookie,
  decodeAffCookie,
  generateAffiliateCode,
  resolveCommissionRule,
  addDays,
  hashIp,
};
