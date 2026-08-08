import type { Session } from "next-auth";

export function ehAdminPlataforma(sessao: Session | null | undefined): boolean {
  return Boolean(sessao?.user?.ehAdminPlataforma);
}

export function estaEmSuporte(sessao: Session | null | undefined): boolean {
  return Boolean(
    sessao?.user?.ehAdminPlataforma && sessao?.user?.suporteAcessoId,
  );
}
