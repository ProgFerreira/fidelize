import { describe, expect, it } from "vitest";
import { hmacSha256Hex, secretsMatch } from "@/lib/security/secrets";

describe("secretsMatch", () => {
  it("aceita iguais", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
  });

  it("rejeita diferentes e vazios", () => {
    expect(secretsMatch("abc", "abd")).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
    expect(secretsMatch("abc", null)).toBe(false);
    expect(secretsMatch(undefined, "abc")).toBe(false);
  });
});

describe("hmacSha256Hex", () => {
  it("é determinístico", () => {
    expect(hmacSha256Hex("s", "body")).toBe(hmacSha256Hex("s", "body"));
    expect(hmacSha256Hex("s", "body")).not.toBe(hmacSha256Hex("s", "other"));
  });
});
