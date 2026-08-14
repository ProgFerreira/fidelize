import { describe, expect, it } from "vitest";
import { phoneCandidates } from "@/lib/otp";

describe("phoneCandidates", () => {
  it("normaliza e inclui variante 55", () => {
    const set = phoneCandidates("(11) 99999-8888");
    expect(set).toContain("11999998888");
    expect(set).toContain("5511999998888");
  });

  it("ignora vazio", () => {
    expect(phoneCandidates("")).toEqual([]);
  });
});
