import { describe, it, expect } from "vitest";
import { staffUserSchema } from "@/lib/users";

describe("staffUserSchema", () => {
  it("normaliza e-mail e telefone", () => {
    const parsed = staffUserSchema.parse({
      name: " Ana Souza ",
      email: "Ana@Clinica.com ",
      phone: "(11) 98888-7777",
      roleCode: "RECEPTION",
      unitId: "",
      status: "ACTIVE",
    });
    expect(parsed.name).toBe("Ana Souza");
    expect(parsed.email).toBe("ana@clinica.com");
    expect(parsed.phone).toBe("11988887777");
    expect(parsed.unitId).toBeNull();
  });

  it("aceita telefone vazio", () => {
    const parsed = staffUserSchema.parse({
      name: "Ana Souza",
      email: "ana@clinica.com",
      phone: "",
      roleCode: "FINANCE",
    });
    expect(parsed.phone).toBeNull();
    expect(parsed.status).toBe("ACTIVE");
  });

  it("rejeita e-mail inválido", () => {
    const r = staffUserSchema.safeParse({
      name: "Ana Souza",
      email: "nao-e-email",
      roleCode: "ADMIN",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /e-mail/i.test(i.message))).toBe(true);
    }
  });

  it("rejeita perfil que não é da equipe", () => {
    const r = staffUserSchema.safeParse({
      name: "Ana Souza",
      email: "ana@clinica.com",
      roleCode: "PLATFORM_ADMIN",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita nome curto", () => {
    const r = staffUserSchema.safeParse({
      name: "Al",
      email: "ana@clinica.com",
      roleCode: "MANAGER",
    });
    expect(r.success).toBe(false);
  });
});
