/**
 * Contrato do app white-label (React Native / Flutter).
 * O app nativo consome as mesmas rotas HTTP — não há SDK proprietário.
 */

export const MOBILE_CONTRACT_VERSION = "1.1.0";

export const mobileAuthFlow = {
  requestOtp: {
    method: "POST",
    path: "/api/v1/mobile/otp/request",
    headers: { "x-api-key": "clinic_api_key" },
    body: { phone: "string" },
  },
  verifyOtp: {
    method: "POST",
    path: "/api/v1/mobile/otp/verify",
    headers: { "x-api-key": "clinic_api_key" },
    body: { phone: "string", code: "string" },
    response: {
      sessionToken: "string",
      expiresAt: "iso8601",
      patientId: "string",
      clinicId: "string",
    },
  },
} as const;

export const mobileEndpoints = [
  {
    method: "POST",
    path: "/api/v1/mobile/home",
    auth: "x-api-key + x-session-token",
    desc: "Resumo do portal",
  },
  {
    method: "POST",
    path: "/api/v1/mobile/push/register",
    auth: "x-api-key + x-session-token",
    desc: "Registrar device push",
  },
  {
    method: "POST",
    path: "/api/v1/mobile/receipts",
    auth: "x-api-key + x-session-token",
    desc: "Enviar comprovante",
  },
] as const;

export const brandingContract = {
  clinicName: "string",
  tradeName: "string?",
  primaryColor: "hex",
  logoUrl: "url?",
  customDomain: "string?",
} as const;

export type MobileSessionClaims = {
  patientId: string;
  clinicId: string;
  fullName: string;
  iat: number;
  exp: number;
};

export function describeMobileWhiteLabel() {
  return {
    version: MOBILE_CONTRACT_VERSION,
    auth: mobileAuthFlow,
    endpoints: mobileEndpoints,
    branding: brandingContract,
    notes: [
      "Não armazenar dados clínicos no app.",
      "Após OTP, envie x-session-token (ou Authorization: Bearer) em todas as rotas do paciente.",
      "Push requer módulo PUSH ativo, FCM HTTP v1 (FCM_SERVICE_ACCOUNT_JSON) e consentimento.",
      "White-label: configurar cores/logo via Setting branding.*",
    ],
  };
}
