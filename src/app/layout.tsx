import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AffiliateTracker } from "@/components/affiliates/affiliate-tracker";
import {
  buscarClinicaPorHost,
  buscarOrganizacaoPorSlug,
  resolverHost,
} from "@/lib/organization";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("host");
  const resolved = resolverHost(host);
  let tenantName: string | null = null;

  const clinic = host ? await buscarClinicaPorHost(host) : null;
  if (clinic?.name) {
    tenantName = clinic.name;
  } else if (resolved.tipo === "organizacao") {
    const org = await buscarOrganizacaoPorSlug(resolved.slug);
    tenantName = org?.name ?? null;
  }

  const title = tenantName
    ? `Fidelize — ${tenantName}`
    : "Fidelize — Clube de Benefícios";

  return {
    title: { default: title, template: "%s · Fidelize" },
    description:
      "Plataforma de fidelidade com cashback, pontos, cartão digital e campanhas.",
    applicationName: "Fidelize",
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900">
        <SessionProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <AffiliateTracker />
            </Suspense>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
