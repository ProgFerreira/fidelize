"use client";

import { RouteError } from "@/components/ui/route-error";

export default function StaffError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError
      error={error}
      retry={retry}
      homeHref="/dashboard"
      homeLabel="Painel"
    />
  );
}
