/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Campo, Input } from "./input";

describe("Campo", () => {
  it("associa o rótulo ao controle via htmlFor/id", () => {
    render(
      <Campo label="Telefone" obrigatorio>
        <Input />
      </Campo>,
    );
    const input = screen.getByLabelText(/Telefone/);
    expect(input.tagName).toBe("INPUT");
    expect(input.id).toBeTruthy();
  });

  it("marca o campo inválido e descreve o erro", () => {
    render(
      <Campo label="Código" erro="Código inválido">
        <Input />
      </Campo>,
    );
    const input = screen.getByLabelText(/Código/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const erro = screen.getByText("Código inválido");
    expect(input.getAttribute("aria-describedby")).toBe(erro.id);
  });
});
