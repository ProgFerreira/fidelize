import { describe, expect, it } from "vitest";
import { parseConsentimentoCsv } from "@/lib/patients/csv-consent";

describe("parseConsentimentoCsv", () => {
  it("só aceita sim/true/1/yes", () => {
    expect(parseConsentimentoCsv("sim")).toBe(true);
    expect(parseConsentimentoCsv("TRUE")).toBe(true);
    expect(parseConsentimentoCsv("1")).toBe(true);
    expect(parseConsentimentoCsv("yes")).toBe(true);
  });

  it("default é false — não assume consentimento", () => {
    expect(parseConsentimentoCsv(undefined)).toBe(false);
    expect(parseConsentimentoCsv("")).toBe(false);
    expect(parseConsentimentoCsv("ok")).toBe(false);
    expect(parseConsentimentoCsv("não")).toBe(false);
  });
});
