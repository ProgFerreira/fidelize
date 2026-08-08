import { Prisma } from "@/generated/prisma/client";
import {
  resolverContextoTenant,
  SemContextoTenantError,
} from "@/lib/tenant";

/**
 * EXTENSÃO DE ISOLAMENTO MULTIEMPRESA
 *
 * Injeta `organizationId` em toda operação do Prisma sobre model de negócio.
 * Lista estática: o client Prisma 7 gerado em `src/generated/prisma` não
 * exporta DMMF. Ao adicionar model com `organizationId`, inclua o nome aqui.
 */

const MODELOS_TENANT: ReadonlySet<string> = new Set([
  "Clinic",
  "Unit",
  "Role",
  "User",
  "Patient",
  "Consent",
  "Category",
  "Wallet",
  "Card",
  "Procedure",
  "Appointment",
  "Payment",
  "LedgerEntry",
  "CreditLot",
  "Redemption",
  "Campaign",
  "Coupon",
  "Setting",
  "IdempotencyKey",
  "AuditLog",
  "NotificationTemplate",
  "PatientOtp",
  "FeatureModule",
  "ModuleConfiguration",
  "OnboardingChecklist",
  "CustomerTag",
  "CustomerTagAssignment",
  "DynamicSegment",
  "MessageTemplate",
  "Communication",
  "CommunicationPreference",
  "ConsentRecord",
  "Automation",
  "AutomationExecution",
  "ReferralProgram",
  "Referral",
  "SatisfactionSurvey",
  "SurveyResponse",
  "RecoveryCase",
  "Reward",
  "RewardRedemption",
  "Voucher",
  "VoucherRedemption",
  "GiftCard",
  "AcceleratorRule",
  "CampaignAttribution",
  "ApiCredential",
  "WebhookEndpoint",
  "IntegrationLog",
  "PlatformAccess",
]);

/**
 * Models em que a linha pode legitimamente não ter dono (sem CHECK NOT NULL).
 * Em Prisma o campo é opcional porque a extensão preenche nas creates.
 */
export const MODELOS_SEM_DONO_PERMITIDO: ReadonlySet<string> = new Set([
  "User",
  "AuditLog",
  "IntegrationLog",
]);

const LEITURAS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const ESCRITAS_COM_WHERE = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const CRIACOES = new Set(["create", "createMany", "createManyAndReturn"]);

type Args = Record<string, unknown>;

function mesclarWhere(where: unknown, organizationId: string): Args {
  const atual = (where ?? {}) as Args;

  if ("organizationId" in atual && atual.organizationId !== organizationId) {
    return { AND: [atual, { organizationId }] };
  }

  return { ...atual, organizationId };
}

function preencherData(data: unknown, organizationId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...(item as Args), organizationId }));
  }
  return { ...(data as Args), organizationId };
}

export const extensaoTenant = Prisma.defineExtension({
  name: "isolamento-organizacao",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!MODELOS_TENANT.has(model)) return query(args);

        const ctx = await resolverContextoTenant();

        if (ctx.semEscopo) return query(args);

        const organizationId = ctx.organizationId;

        if (!organizationId) {
          throw new SemContextoTenantError(model, operation);
        }

        const a = (args ?? {}) as Args;
        const executar = query as (args: unknown) => Promise<unknown>;

        if (LEITURAS.has(operation) || ESCRITAS_COM_WHERE.has(operation)) {
          return executar({
            ...a,
            where: mesclarWhere(a.where, organizationId),
          });
        }

        if (CRIACOES.has(operation)) {
          return executar({
            ...a,
            data: preencherData(a.data, organizationId),
          });
        }

        if (operation === "upsert") {
          return executar({
            ...a,
            where: mesclarWhere(a.where, organizationId),
            create: preencherData(a.create, organizationId),
          });
        }

        throw new Error(
          `Operação "${operation}" em "${model}" não é coberta pelo isolamento ` +
            `multiempresa. Adicione o tratamento em src/lib/prisma-tenant.ts ` +
            `antes de usá-la.`,
        );
      },
    },
  },
});

export const _internos = {
  MODELOS_TENANT,
  LEITURAS,
  ESCRITAS_COM_WHERE,
  CRIACOES,
};
