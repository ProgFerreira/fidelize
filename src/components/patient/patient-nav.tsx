"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Gift,
  Home,
  MoreHorizontal,
  Sparkles,
  UserRound,
  Wallet,
  Ticket,
  Share2,
  Dices,
  Receipt,
  ScrollText,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icone: typeof Home;
  module?: "REFERRAL" | "VOUCHERS" | "RAFFLES";
};

const PRINCIPAIS: NavItem[] = [
  { href: "/p", label: "Início", icone: Home },
  { href: "/p/agendar", label: "Agenda", icone: CalendarDays },
  { href: "/p/carteira", label: "Carteira", icone: Wallet },
  { href: "/p/recompensas", label: "Prêmios", icone: Gift },
];

const MAIS: NavItem[] = [
  { href: "/p/beneficios", label: "Benefícios", icone: Sparkles },
  { href: "/p/extrato", label: "Extrato", icone: Receipt },
  { href: "/p/indicacoes", label: "Indicar", icone: Share2, module: "REFERRAL" },
  { href: "/p/clube", label: "Clube VIP", icone: Crown },
  { href: "/p/regulamento", label: "Regulamento", icone: ScrollText },
  { href: "/p/vouchers", label: "Vouchers", icone: Ticket, module: "VOUCHERS" },
  { href: "/p/sorteios", label: "Sorteios", icone: Dices, module: "RAFFLES" },
  { href: "/p/perfil", label: "Perfil", icone: UserRound },
];

function rotaAtiva(pathname: string, href: string) {
  if (href === "/p") return pathname === "/p";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PatientNav({
  modules = {},
}: {
  modules?: Partial<Record<"REFERRAL" | "VOUCHERS" | "RAFFLES", boolean>>;
}) {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const maisItems = MAIS.filter((item) => !item.module || modules[item.module]);
  const maisAtivo = maisItems.some((item) => rotaAtiva(pathname, item.href));

  useEffect(() => {
    setMaisAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!maisAberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMaisAberto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [maisAberto]);

  return (
    <>
      {maisAberto ? (
        <button
          type="button"
          className="portal-nav__overlay"
          aria-label="Fechar menu"
          onClick={() => setMaisAberto(false)}
        />
      ) : null}
      {maisAberto ? (
        <div className="portal-nav__sheet" role="dialog" aria-modal="true" aria-label="Mais opções">
          {maisItems.map((item) => {
            const Icone = item.icone;
            const atual = rotaAtiva(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={atual ? "page" : undefined}
                className={cn("portal-nav__sheet-link", atual && "portal-nav__sheet-link--ativo")}
              >
                <Icone className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      <nav className="portal-nav" aria-label="Menu do paciente">
        <div className="portal-nav__inner">
          {PRINCIPAIS.map((item) => {
            const Icone = item.icone;
            const atual = rotaAtiva(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={atual ? "page" : undefined}
                className={cn("portal-nav__item", atual && "portal-nav__item--ativo")}
              >
                <Icone className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className={cn(
              "portal-nav__item",
              (maisAberto || maisAtivo) && "portal-nav__item--ativo",
            )}
            aria-expanded={maisAberto}
            aria-haspopup="dialog"
            onClick={() => setMaisAberto((v) => !v)}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            Mais
          </button>
        </div>
      </nav>
    </>
  );
}
