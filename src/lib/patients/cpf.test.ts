import { describe, it, expect } from "vitest";
import { formatCpf, formatPhone, isValidCpf, onlyDigits } from "./cpf";

describe("cpf", () => {
  it("valida CPF conhecido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("normaliza dígitos", () => {
    expect(onlyDigits("11.9.9999-9999")).toBe("11999999999");
  });

  it("formata CPF com 11 dígitos", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("mantém o valor original se não tiver 11 dígitos", () => {
    expect(formatCpf("123")).toBe("123");
  });

  it("formata telefone celular (11 dígitos) e fixo (10 dígitos)", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("mantém o valor original se o telefone não tiver 10 ou 11 dígitos", () => {
    expect(formatPhone("123")).toBe("123");
  });
});
