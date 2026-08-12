"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Reforça o rastreamento de ?ref= em páginas que chegam a renderizar no client.
 * O proxy também grava o cookie fid_aff antes de redirects de auth.
 */
export function AffiliateTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;

    const visitToken =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now()}`;

    void fetch("/api/affiliates/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: ref,
        landingPath: pathname,
        referer: document.referrer || null,
        utmSource: searchParams.get("utm_source"),
        utmMedium: searchParams.get("utm_medium"),
        utmCampaign: searchParams.get("utm_campaign"),
        visitToken,
      }),
      credentials: "same-origin",
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}
