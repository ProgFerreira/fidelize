import * as Sentry from "@sentry/nextjs";

/**
 * Sentry.init é seguro sem DSN — só não envia nada (no-op) até
 * NEXT_PUBLIC_SENTRY_DSN ser configurado no ambiente.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
