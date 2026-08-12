"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintExtractButton() {
  return (
    <Button
      type="button"
      variant="contorno"
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4" aria-hidden />
      Imprimir
    </Button>
  );
}
