"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyAffiliateLink({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      variante="secundario"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
    >
      {ok ? "Copiado!" : "Copiar link"}
    </Button>
  );
}
