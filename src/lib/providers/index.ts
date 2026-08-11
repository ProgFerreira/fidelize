import { prisma } from "@/lib/db";

export type ProviderSendInput = {
  clinicId: string;
  to: string;
  subject?: string | null;
  body: string;
  channel: "WHATSAPP" | "EMAIL" | "SMS" | "PUSH";
  metadata?: Record<string, unknown>;
};

export type ProviderSendResult = {
  ok: boolean;
  provider: string;
  providerId?: string;
  simulated: boolean;
  error?: string;
  delivered?: boolean;
};

export type ProvidersConfig = {
  email?: { provider: "resend" | "smtp" | "simulated"; from?: string };
  sms?: { provider: "twilio" | "simulated"; from?: string };
  whatsapp?: { provider: "meta" | "simulated"; phoneNumberId?: string };
  push?: { provider: "fcm" | "fcm_v1" | "simulated" };
};

export async function getProvidersConfig(clinicId: string): Promise<ProvidersConfig> {
  const setting = await prisma.setting.findUnique({
    where: { clinicId_key: { clinicId, key: "providers.config" } },
  });
  const clinic = (setting?.value as ProvidersConfig | null) ?? {};
  return {
    email: clinic.email ?? {
      provider: process.env.RESEND_API_KEY ? "resend" : "simulated",
      from: process.env.EMAIL_FROM ?? "noreply@fidelize.local",
    },
    sms: clinic.sms ?? {
      provider:
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
          ? "twilio"
          : "simulated",
      from: process.env.TWILIO_FROM ?? undefined,
    },
    whatsapp: clinic.whatsapp ?? {
      provider: process.env.WHATSAPP_TOKEN ? "meta" : "simulated",
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    },
    push: clinic.push ?? {
      provider:
        process.env.FCM_SERVICE_ACCOUNT_JSON || process.env.FCM_PROJECT_ID
          ? "fcm_v1"
          : process.env.FCM_SERVER_KEY
            ? "fcm"
            : "simulated",
    },
  };
}

async function sendResendEmail(input: ProviderSendInput, from: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return {
      ok: false,
      provider: "resend",
      simulated: false,
      error: "RESEND_API_KEY ausente",
    } satisfies ProviderSendResult;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject || "Clube de Benefícios",
      text: input.body,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return {
      ok: false,
      provider: "resend",
      simulated: false,
      error: json.message || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    provider: "resend",
    providerId: json.id,
    simulated: false,
    delivered: true,
  };
}

async function sendTwilioSms(input: ProviderSendInput, from?: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = from || process.env.TWILIO_FROM;
  if (!sid || !token || !fromNumber) {
    return {
      ok: false,
      provider: "twilio",
      simulated: false,
      error: "Credenciais Twilio incompletas",
    } satisfies ProviderSendResult;
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    To: input.to.startsWith("+") ? input.to : `+55${input.to.replace(/\D/g, "")}`,
    From: fromNumber,
    Body: input.body.slice(0, 1600),
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10000),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      provider: "twilio",
      simulated: false,
      error: json.message || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    provider: "twilio",
    providerId: json.sid,
    simulated: false,
    delivered: true,
  };
}

async function sendMetaWhatsApp(input: ProviderSendInput, phoneNumberId?: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return {
      ok: false,
      provider: "meta",
      simulated: false,
      error: "Credenciais WhatsApp Meta incompletas",
    } satisfies ProviderSendResult;
  }
  const to = input.to.replace(/\D/g, "");
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: input.body.slice(0, 4096) },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      provider: "meta",
      simulated: false,
      error: json.error?.message || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    provider: "meta",
    providerId: json.messages?.[0]?.id,
    simulated: false,
    delivered: true,
  };
}

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

function readFcmServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

/** Access token OAuth2 via JWT (FCM HTTP v1). Sem libs externas. */
async function getFcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const { createSign } = await import("crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const signature = signer
    .sign(sa.private_key.replace(/\\n/g, "\n"))
    .toString("base64url");

  const assertion = `${header}.${claim}.${signature}`;
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };
  return json.access_token ?? null;
}

async function sendFcmHttpV1(input: ProviderSendInput) {
  const sa = readFcmServiceAccount();
  const projectId = sa?.project_id || process.env.FCM_PROJECT_ID;
  if (!sa || !projectId) {
    return {
      ok: false,
      provider: "fcm_v1",
      simulated: false,
      error: "FCM_SERVICE_ACCOUNT_JSON / FCM_PROJECT_ID ausente",
    } satisfies ProviderSendResult;
  }

  const accessToken = await getFcmAccessToken(sa);
  if (!accessToken) {
    return {
      ok: false,
      provider: "fcm_v1",
      simulated: false,
      error: "Falha ao obter access token FCM",
    } satisfies ProviderSendResult;
  }

  const dataEntries = Object.fromEntries(
    Object.entries(input.metadata ?? {}).map(([k, v]) => [k, String(v)]),
  );

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: input.to,
          notification: {
            title: input.subject || "Clube de Benefícios",
            body: input.body.slice(0, 240),
          },
          data: dataEntries,
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    name?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ok: false,
      provider: "fcm_v1",
      simulated: false,
      error: json.error?.message || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    provider: "fcm_v1",
    providerId: json.name,
    simulated: false,
    delivered: true,
  };
}

/** @deprecated API legacy — prefer FCM HTTP v1 */
async function sendFcmPushLegacy(input: ProviderSendInput) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) {
    return {
      ok: false,
      provider: "fcm",
      simulated: false,
      error: "FCM_SERVER_KEY ausente",
    } satisfies ProviderSendResult;
  }
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      notification: {
        title: input.subject || "Clube de Benefícios",
        body: input.body.slice(0, 240),
      },
      data: input.metadata ?? {},
    }),
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    message_id?: number;
    error?: string;
  };
  if (!res.ok || json.error) {
    return {
      ok: false,
      provider: "fcm",
      simulated: false,
      error: json.error || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    provider: "fcm",
    providerId: String(json.message_id ?? ""),
    simulated: false,
    delivered: true,
  };
}

function simulate(channel: string, to: string): ProviderSendResult {
  return {
    ok: true,
    provider: `sim_${channel.toLowerCase()}`,
    providerId: `sim_${Date.now().toString(36)}`,
    simulated: true,
    delivered: true,
  };
}

export async function dispatchProvider(
  input: ProviderSendInput,
): Promise<ProviderSendResult> {
  const config = await getProvidersConfig(input.clinicId);

  try {
    if (input.channel === "EMAIL") {
      if (config.email?.provider === "resend") {
        return sendResendEmail(input, config.email.from || "noreply@fidelize.local");
      }
      return simulate("email", input.to);
    }
    if (input.channel === "SMS") {
      if (config.sms?.provider === "twilio") {
        return sendTwilioSms(input, config.sms.from);
      }
      return simulate("sms", input.to);
    }
    if (input.channel === "WHATSAPP") {
      if (config.whatsapp?.provider === "meta") {
        return sendMetaWhatsApp(input, config.whatsapp.phoneNumberId);
      }
      return simulate("whatsapp", input.to);
    }
    if (input.channel === "PUSH") {
      if (config.push?.provider === "fcm_v1") {
        return sendFcmHttpV1(input);
      }
      if (config.push?.provider === "fcm") {
        return sendFcmPushLegacy(input);
      }
      return simulate("push", input.to);
    }
  } catch (error) {
    const { captureException } = await import("@/lib/observability");
    await captureException(error, {
      channel: input.channel,
      clinicId: input.clinicId,
    });
    return {
      ok: false,
      provider: input.channel.toLowerCase(),
      simulated: false,
      error: error instanceof Error ? error.message : "Falha no provedor",
    };
  }

  return simulate(input.channel, input.to);
}

export function providersStatusSummary(config: ProvidersConfig) {
  return {
    email: config.email?.provider ?? "simulated",
    sms: config.sms?.provider ?? "simulated",
    whatsapp: config.whatsapp?.provider ?? "simulated",
    push: config.push?.provider ?? "simulated",
  };
}
