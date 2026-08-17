/** @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shell } from "./shell";
import type { MenuGrupo } from "@/lib/menus";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/components/layout/clinic-switcher", () => ({
  ClinicSwitcher: () => null,
}));

const grupos: MenuGrupo[] = [
  {
    area: { id: "frequentes", label: "Frequentes" },
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        rota: "/dashboard",
        icone: "LayoutDashboard",
        area: "inicio",
      },
    ],
  },
  {
    area: { id: "clientes", label: "Clientes" },
    items: [
      {
        id: "pacientes",
        label: "Pacientes",
        rota: "/pacientes",
        icone: "Users",
        area: "clientes",
      },
    ],
  },
  {
    area: { id: "configuracoes", label: "Configurações" },
    items: [
      {
        id: "usuarios",
        label: "Usuários",
        rota: "/usuarios",
        icone: "UserCog",
        area: "configuracoes",
      },
    ],
  },
];

const usuario = { nome: "Admin", email: "admin@dermaphios.com" };

describe("Shell - estado padrão do menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("primeira visita (sem preferência salva): abre Frequentes, colapsa o resto", async () => {
    render(
      <Shell grupos={grupos} usuario={usuario}>
        <div>conteúdo</div>
      </Shell>,
    );

    expect(await screen.findByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText("Pacientes")).toBeNull();
    expect(screen.queryByText("Usuários")).toBeNull();

    expect(
      screen.getByRole("button", { name: /Clientes/i }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: /Configurações/i })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("respeita preferência já salva no localStorage (usuário que já mexeu no menu)", async () => {
    window.localStorage.setItem("fidelize.menu.recolhidos", JSON.stringify([]));

    render(
      <Shell grupos={grupos} usuario={usuario}>
        <div>conteúdo</div>
      </Shell>,
    );

    expect(await screen.findByText("Pacientes")).toBeTruthy();
    expect(await screen.findByText("Usuários")).toBeTruthy();
  });
});
