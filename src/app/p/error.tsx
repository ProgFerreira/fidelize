"use client";

import { RouteError } from "@/components/ui/route-error";

export default function PatientError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <RouteError error={error} retry={retry} homeHref="/p" homeLabel="Início" />
  );
}
