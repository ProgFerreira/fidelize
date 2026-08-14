"use client";

import { Link2 } from "lucide-react";
import { Button, toast } from "@/components/ui";

export function CopyLinkButton({ url }: { url: string }) {
  async function handleClick() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do paciente copiado.");
    } catch {
      toast.error("Não foi possível copiar. Link: " + url);
    }
  }

  return (
    <Button type="button" size="sm" variant="secondary" onClick={handleClick}>
      <Link2 className="h-4 w-4" /> Copiar link do paciente
    </Button>
  );
}
