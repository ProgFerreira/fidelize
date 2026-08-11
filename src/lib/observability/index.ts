/**
 * Observabilidade leve: Sentry via envelope HTTP quando SENTRY_DSN está
 * configurado; caso contrário, log estruturado em stderr.
 */

type Severity = "fatal" | "error" | "warning" | "info";

function sentryDsnParts() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    return {
      publicKey,
      projectId,
      host: url.host,
      ingest: `${url.protocol}//${url.host}/api/${projectId}/store/`,
    };
  } catch {
    return null;
  }
}

export async function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const payload = {
    level: "error" as Severity,
    message,
    stack,
    context: context ?? {},
    timestamp: new Date().toISOString(),
  };

  const sentry = sentryDsnParts();
  if (!sentry) {
    console.error("[observability]", JSON.stringify(payload));
    return;
  }

  try {
    await fetch(sentry.ingest, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${sentry.publicKey}, sentry_client=fidelize/1.0`,
      },
      body: JSON.stringify({
        message,
        level: "error",
        platform: "node",
        timestamp: Date.now() / 1000,
        exception: {
          values: [
            {
              type: error instanceof Error ? error.name : "Error",
              value: message,
              stacktrace: stack
                ? { frames: stack.split("\n").slice(1).map((l) => ({ filename: l.trim() })) }
                : undefined,
            },
          ],
        },
        extra: context,
        tags: { app: "fidelize" },
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (sendError) {
    console.error("[observability] falha ao enviar ao Sentry", sendError);
    console.error("[observability]", JSON.stringify(payload));
  }
}

export async function captureMessage(
  message: string,
  level: Severity = "info",
  context?: Record<string, unknown>,
) {
  const payload = {
    level,
    message,
    context: context ?? {},
    timestamp: new Date().toISOString(),
  };

  if (level === "error" || level === "fatal" || level === "warning") {
    console.error("[observability]", JSON.stringify(payload));
  } else if (process.env.NODE_ENV !== "production") {
    console.info("[observability]", JSON.stringify(payload));
  }

  if (level === "error" || level === "fatal") {
    await captureException(new Error(message), context);
  }
}

export function observabilityStatus() {
  return {
    sentryConfigured: Boolean(process.env.SENTRY_DSN?.trim()),
    environment: process.env.NODE_ENV ?? "development",
  };
}
