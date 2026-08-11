import { describe, expect, it } from "vitest";
import { providersStatusSummary } from "@/lib/providers";
import { describeMobileWhiteLabel } from "@/lib/mobile/contract";
import { BROWSER_EXTENSION_CONTRACT } from "@/lib/extension/contract";
import { widgetEmbedSnippet } from "@/lib/widget";

describe("Providers config summary", () => {
  it("defaults to simulated when empty", () => {
    expect(providersStatusSummary({})).toEqual({
      email: "simulated",
      sms: "simulated",
      whatsapp: "simulated",
      push: "simulated",
    });
  });
});

describe("Mobile white-label contract", () => {
  it("exposes versioned endpoints", () => {
    const c = describeMobileWhiteLabel();
    expect(c.version).toBe("1.1.0");
    expect(c.endpoints.some((e) => e.path.includes("push"))).toBe(true);
  });
});

describe("Widget and extension", () => {
  it("builds embed snippet", () => {
    expect(widgetEmbedSnippet("https://app.test")).toContain("/embed/widget");
  });
  it("exposes browser extension contract", () => {
    expect(BROWSER_EXTENSION_CONTRACT.endpoint.path).toBe("/api/v1/widget");
  });
});
