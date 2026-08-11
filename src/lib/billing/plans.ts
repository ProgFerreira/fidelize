import type { ModuleCode } from "@/generated/prisma/client";

export type PlanCode = "trial" | "start" | "pro" | "vip";

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  tagline: string;
  monthlyPriceBrl: number | null;
  maxUsers: number | null;
  maxClinics: number | null;
  maxPatients: number | null;
  modules: ModuleCode[];
  features: string[];
};

/** Combos alinhados à referência de mercado (Start / Pro / Vip). */
export const PLAN_CATALOG: PlanDefinition[] = [
  {
    code: "trial",
    name: "Trial",
    tagline: "Avaliação gratuita por tempo limitado",
    monthlyPriceBrl: 0,
    maxUsers: 3,
    maxClinics: 1,
    maxPatients: 200,
    modules: [
      "CASHBACK",
      "POINTS",
      "CATEGORIES",
      "TAGS",
      "CONSENT",
      "COMMUNICATIONS",
      "WHATSAPP",
      "NPS",
    ],
    features: [
      "Cashback ou pontos",
      "Portal do paciente",
      "WhatsApp (com credenciais)",
      "Checklist de implantação",
    ],
  },
  {
    code: "start",
    name: "Start",
    tagline: "Porta de entrada para a clínica fidelizar sem dor",
    monthlyPriceBrl: 279,
    maxUsers: 5,
    maxClinics: 1,
    maxPatients: 2000,
    modules: [
      "CASHBACK",
      "POINTS",
      "CATEGORIES",
      "TAGS",
      "CONSENT",
      "COMMUNICATIONS",
      "WHATSAPP",
      "EMAIL",
      "NPS",
      "REFERRAL",
      "REWARDS",
      "VOUCHERS",
      "BIRTHDAY",
      "AUTOMATIONS",
    ],
    features: [
      "Fidelização por pontos ou cashback",
      "Portal + cartão digital",
      "WhatsApp e e-mail",
      "Indicação e recompensas",
      "Mentoria de implantação (checklist)",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    tagline: "Crescer no automático com IA e engajamento",
    monthlyPriceBrl: 479,
    maxUsers: 15,
    maxClinics: 3,
    maxPatients: 15000,
    modules: [
      "CASHBACK",
      "POINTS",
      "CATEGORIES",
      "TAGS",
      "CONSENT",
      "COMMUNICATIONS",
      "WHATSAPP",
      "EMAIL",
      "SMS",
      "PUSH",
      "NPS",
      "REFERRAL",
      "REWARDS",
      "VOUCHERS",
      "GIFT_CARD",
      "BIRTHDAY",
      "AUTOMATIONS",
      "ACCELERATORS",
      "SEGMENTS",
      "RAFFLES",
      "RECEIPTS",
      "PREDICTIVE",
    ],
    features: [
      "Tudo do Start",
      "Preditivo, sorteios e comprovantes",
      "Push e app white-label (API)",
      "Aceleradores e segmentos",
      "Vale-presente",
    ],
  },
  {
    code: "vip",
    name: "Vip",
    tagline: "Rede e operação grande com API dedicada",
    monthlyPriceBrl: null,
    maxUsers: null,
    maxClinics: null,
    maxPatients: null,
    modules: [
      "CASHBACK",
      "POINTS",
      "CATEGORIES",
      "TAGS",
      "CONSENT",
      "COMMUNICATIONS",
      "WHATSAPP",
      "EMAIL",
      "SMS",
      "PUSH",
      "NPS",
      "REFERRAL",
      "REWARDS",
      "VOUCHERS",
      "GIFT_CARD",
      "BIRTHDAY",
      "AUTOMATIONS",
      "ACCELERATORS",
      "SEGMENTS",
      "RAFFLES",
      "RECEIPTS",
      "PREDICTIVE",
    ],
    features: [
      "Tudo do Pro",
      "Multi-unidade ilimitado",
      "API e integrações clínicas",
      "Limites sob medida",
      "Suporte dedicado",
    ],
  },
];

export function getPlan(code: string | null | undefined): PlanDefinition {
  const normalized = (code || "trial").toLowerCase() as PlanCode;
  return PLAN_CATALOG.find((p) => p.code === normalized) ?? PLAN_CATALOG[0];
}

export function normalizePlanCode(code: string | null | undefined): PlanCode {
  return getPlan(code).code;
}
