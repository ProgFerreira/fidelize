export type TransactionalEmailResult = {
  ok: boolean;
  simulated: boolean;
  error?: string;
};

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<TransactionalEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@fidelize.local";

  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email:simulado]", {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    }
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        simulated: false,
        error: json.message || `HTTP ${res.status}`,
      };
    }
    return { ok: true, simulated: false };
  } catch (error) {
    return {
      ok: false,
      simulated: false,
      error: error instanceof Error ? error.message : "Falha ao enviar e-mail",
    };
  }
}
