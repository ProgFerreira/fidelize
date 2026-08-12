import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sem standalone: Hostinger usa `next start` e injeta/.env normalmente
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-mariadb",
    "mariadb",
    "prisma",
    "tsx",
  ],
};

// withSentryConfig é seguro sem SENTRY_AUTH_TOKEN/org/project — só pula o
// upload de source maps e loga um aviso, não quebra o build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  treeshake: { removeDebugLogging: true },
});
