import { describe, it, expect } from "vitest";
import { isValidCpf, onlyDigits } from "./cpf";

describe("cpf", () => {
  it("valida CPF conhecido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("normaliza dígitos", () => {
    expect(onlyDigits("11.9.9999-9999")).toBe("11999999999");
  });
});
