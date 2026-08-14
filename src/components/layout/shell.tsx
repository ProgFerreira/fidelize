"use client";

import * as Icons from "lucide-react";
import {
  ChevronDown,
  LogOut,
  Menu,
  X,
  User,
  Stethoscope,
  Package,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { MenuDef, MenuGrupo } from "@/lib/menus";
import { ClinicSwitcher } from "@/components/layout/clinic-switcher";
import { labelPt } from "@/lib/i18n/labels";

const STORAGE_KEY = "fidelize.menu.recolhidos";

function Icone({ nome, className }: { nome: string; className?: string }) {
  const Componente =
    (Icons as unknown as Record<string, typeof Package>)[nome] || Package;
  return <Componente className={className} aria-hidden />;
}

function rotaAtiva(pathname: string, rota: string) {
  return pathname === rota || pathname.startsWith(`${rota}/`);
}

function grupoTemRotaAtiva(grupo: MenuGrupo, pathname: string) {
  return grupo.items.some((item) => rotaAtiva(pathname, item.rota));
}

function lerRecolhidos(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function salvarRecolhidos(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

function ItemMenu({
  menu,
  pathname,
  aoNavegar,
}: {
  menu: MenuDef;
  pathname: string;
  aoNavegar: () => void;
}) {
  const ativo = rotaAtiva(pathname, menu.rota);

  return (
    <Link
      href={menu.rota}
      onClick={aoNavegar}
      className={cn("shell-nav__link", ativo && "shell-nav__link--ativo")}
      aria-current={ativo ? "page" : undefined}
    >
      <Icone nome={menu.icone} className="shell-nav__icon" />
      <span className="truncate">{menu.label}</span>
    </Link>
  );
}

function GrupoMenu({
  grupo,
  pathname,
  aberto,
  onToggle,
  aoNavegar,
}: {
  grupo: MenuGrupo;
  pathname: string;
  aberto: boolean;
  onToggle: () => void;
  aoNavegar: () => void;
}) {
  const painelId = `menu-grupo-${grupo.area.id}`;
  const temTitulo = Boolean(grupo.area.label);
  const mostrarItens = !temTitulo || aberto;

  return (
    <div className="shell-nav__grupo">
      {temTitulo ? (
        <button
          type="button"
          className="shell-nav__titulo"
          aria-expanded={aberto}
          aria-controls={painelId}
          onClick={onToggle}
        >
          <span>{grupo.area.label}</span>
          <ChevronDown
            className={cn(
              "shell-nav__chevron",
              aberto && "shell-nav__chevron--aberto",
            )}
            aria-hidden
          />
        </button>
      ) : null}
      {mostrarItens ? (
        <div id={painelId} className="shell-nav__itens" role="group">
          {grupo.items.map((menu) => (
            <ItemMenu
              key={menu.id}
              menu={menu}
              pathname={pathname}
              aoNavegar={aoNavegar}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Shell({
  grupos,
  usuario,
  children,
  clinicId,
  unitId,
  isSupport,
  supportOrgName,
}: {
  grupos: MenuGrupo[];
  usuario: { nome: string; email: string; papel?: string };
  children: React.ReactNode;
  clinicId?: string | null;
  unitId?: string | null;
  isSupport?: boolean;
  supportOrgName?: string | null;
}) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = React.useState(false);
  const [rotaDoMenu, setRotaDoMenu] = React.useState(pathname);
  const [recolhidos, setRecolhidos] = React.useState<Set<string>>(() => new Set());
  const [hidratar, setHidratar] = React.useState(false);

  React.useEffect(() => {
    setRecolhidos(lerRecolhidos());
    setHidratar(true);
  }, []);

  React.useEffect(() => {
    if (!hidratar) return;
    const ativo = grupos.find((g) => grupoTemRotaAtiva(g, pathname));
    if (!ativo?.area.label) return;
    setRecolhidos((prev) => {
      if (!prev.has(ativo.area.id)) return prev;
      const next = new Set(prev);
      next.delete(ativo.area.id);
      salvarRecolhidos(next);
      return next;
    });
  }, [pathname, grupos, hidratar]);

  if (pathname !== rotaDoMenu) {
    setRotaDoMenu(pathname);
    setMenuAberto(false);
  }

  function alternarGrupo(areaId: string) {
    setRecolhidos((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      salvarRecolhidos(next);
      return next;
    });
  }

  const switcher = (
    <ClinicSwitcher
      currentClinicId={clinicId}
      currentUnitId={unitId}
      isSupport={isSupport}
    />
  );

  const navegacao = (
    <nav className="shell-nav" aria-label="Menu principal">
      {grupos.map((grupo) => (
        <GrupoMenu
          key={grupo.area.id}
          grupo={grupo}
          pathname={pathname}
          aberto={!recolhidos.has(grupo.area.id)}
          onToggle={() => alternarGrupo(grupo.area.id)}
          aoNavegar={() => setMenuAberto(false)}
        />
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white print:hidden lg:flex lg:flex-col dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="rounded-md bg-blue-600 p-1.5">
            <Stethoscope className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div>
            <span className="font-semibold">Fidelize</span>
            <p className="text-[10px] leading-none text-slate-500">
              {supportOrgName || "Clube de Benefícios"}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{navegacao}</div>
        {switcher}
      </aside>

      {menuAberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMenuAberto(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-blue-600 p-1.5">
                  <Stethoscope className="h-4 w-4 text-white" aria-hidden />
                </div>
                <span className="font-semibold">Dermaphios</span>
              </div>
              <button
                type="button"
                onClick={() => setMenuAberto(false)}
                aria-label="Fechar menu"
                className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navegacao}</div>
            {switcher}
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 print:hidden dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="rounded p-1.5 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {usuario.papel && (
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 sm:inline dark:bg-slate-800 dark:text-slate-300">
              {labelPt(usuario.papel)}
            </span>
          )}

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{usuario.nome}</p>
              <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">
                {usuario.email}
              </p>
            </div>
            <div className="rounded-full bg-slate-200 p-1.5 dark:bg-slate-700">
              <User className="h-4 w-4" aria-hidden />
            </div>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sair"
                title="Sair"
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
