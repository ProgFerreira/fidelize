/**
 * Contrato do app white-label (React Native / Flutter).
 * O app nativo consome as mesmas rotas HTTP — não há SDK proprietário.
 */

export const MOBILE_CONTRACT_VERSION = "1.0.0";

export const mobileAuthFlow = {
  requestOtp: {
    method: "POST",
    path: "/api/v1/mobile/otp/request",
    body: { phone: "string" },
  },
  verifyOtp: {
    method: "POST",
    path: "/api/v1/mobile/otp/verify",
    body: { phone: "string", code: "string" },
    response: { sessionToken: "string", patientId: "string", clinicId: "string" },
  },
} as const;

export const mobileEndpoints = [
  { method: "GET", path: "/api/v1/balance", auth: "apiKey|session", desc: "Saldo e pontos" },
  { method: "GET", path: "/api/v1/vouchers", auth: "apiKey|session", desc: "Vouchers" },
  { method: "GET", path: "/api/v1/referrals", auth: "apiKey|session", desc: "Indicações" },
  { method: "POST", path: "/api/v1/mobile/push/register", auth: "session", desc: "Registrar device push" },
  { method: "GET", path: "/api/v1/mobile/home", auth: "session", desc: "Resumo do portal" },
  { method: "POST", path: "/api/v1/mobile/receipts", auth: "session", desc: "Enviar comprovante" },
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
      "Push requer módulo PUSH ativo e consentimento.",
      "White-label: configurar cores/logo via Setting branding.*",
    ],
  };
}
