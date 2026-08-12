import { describe, it, expect } from "vitest";
import { patientSchema } from "@/lib/patients";

describe("patientSchema", () => {
  it("aceita CPF/telefone formatados e e-mail vazio", () => {
    const parsed = patientSchema.parse({
      fullName: " Ana Silva ",
      cpf: "529.982.247-25",
      phone: "(11) 98888-7777",
      email: "",
      regulationConsent: true,
    });
    expect(parsed.fullName).toBe("Ana Silva");
    expect(parsed.cpf).toBe("52998224725");
    expect(parsed.phone).toBe("11988887777");
    expect(parsed.email).toBeNull();
  });

  it("rejeita CPF inválido", () => {
    const r = patientSchema.safeParse({
      fullName: "Ana Silva",
      cpf: "111.111.111-11",
      phone: "11988887777",
      regulationConsent: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/CPF inválido/i);
    }
  });

  it("rejeita e-mail inválido", () => {
    const r = patientSchema.safeParse({
      fullName: "Ana Silva",
      cpf: "529.982.247-25",
      phone: "11988887777",
      email: "nao-e-email",
      regulationConsent: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /e-mail/i.test(i.message))).toBe(true);
    }
  });
});
