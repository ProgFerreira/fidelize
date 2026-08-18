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
  "Professional",
  "Appointment",
  "AppointmentItem",
  "TreatmentPackage",
  "ScheduleEvent",
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
  "WidgetOrigin",
  "PushDevice",
  "ReceiptSubmission",
  "Raffle",
  "RaffleTicket",
  "PredictionScore",
  "RevenueForecast",
  "MobileSession",
  "VideoCallRoom",
  "VideoCallSignal",
  "VideoCallRecording",
  "VideoCallChatTranscript",
  "VideoCallAudioTranscript",
  "OrganizationInvoice",
  "MembershipPlan",
  "PatientMembership",
  "AffiliateVisit",
  "AffiliateReferral",
  "PlatformSale",
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

/**
 * findUnique só aceita campos unique. Compound keys (`clinicId_code: {…}`)
 * viram campos soltos para um findFirst equivalente.
 */
export function achatarWhereUnique(where: unknown): Args {
  const atual = (where ?? {}) as Args;
  const out: Args = {};
  for (const [chave, valor] of Object.entries(atual)) {
    if (
      valor &&
      typeof valor === "object" &&
      !Array.isArray(valor) &&
      chave.includes("_") &&
      !("equals" in (valor as object))
    ) {
      Object.assign(out, valor as Args);
    } else {
      out[chave] = valor;
    }
  }
  return out;
}

function preencherData(data: unknown, organizationId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...(item as Args), organizationId }));
  }
  return { ...(data as Args), organizationId };
}

function pertenceAoTenant(
  result: unknown,
  model: string,
  organizationId: string,
): boolean {
  if (!result || typeof result !== "object") return false;
  const org = (result as { organizationId?: string | null }).organizationId;
  if (org === organizationId) return true;
  return org == null && MODELOS_SEM_DONO_PERMITIDO.has(model);
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

        // findUnique não aceita organizationId extra no where. Executa o
        // unique original (permanece na mesma transação) e descarta o
        // registro se for de outra org. Leituras em lista usam WHERE.
        if (operation === "findUnique" || operation === "findUniqueOrThrow") {
          const result = await executar(a);
          if (pertenceAoTenant(result, model, organizationId)) return result;
          if (operation === "findUniqueOrThrow") {
            throw new Error(
              `Nenhum registro de ${model} encontrado nesta organização.`,
            );
          }
          return null;
        }

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
