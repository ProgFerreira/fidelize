import { prisma } from "@/lib/db";
import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { organizacaoAtual } from "@/lib/tenant";

type AuditInput = {
  organizationId?: string | null;
  clinicId?: string | null;
  unitId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      organizationId:
        input.organizationId ?? organizacaoAtual() ?? null,
      clinicId: input.clinicId ?? null,
      unitId: input.unitId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      beforeData: input.beforeData,
      afterData: input.afterData,
      metadata: input.metadata,
    },
  });
}
