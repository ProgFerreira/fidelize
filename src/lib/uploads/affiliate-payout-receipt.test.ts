import path from "path";
import { describe, expect, it } from "vitest";
import {
  absoluteAffiliatePayoutPath,
  affiliatePayoutStorageRoot,
} from "@/lib/uploads/affiliate-payout-receipt";

describe("absoluteAffiliatePayoutPath", () => {
  it("resolve arquivo dentro do storage", () => {
    const got = absoluteAffiliatePayoutPath("aff1/recibo.pdf");
    expect(got.startsWith(path.resolve(affiliatePayoutStorageRoot()))).toBe(true);
    expect(got.endsWith(`${path.sep}aff1${path.sep}recibo.pdf`)).toBe(true);
  });

  it("bloqueia path traversal", () => {
    expect(() => absoluteAffiliatePayoutPath("../secret.txt")).toThrow(
      "Caminho inválido",
    );
    expect(() => absoluteAffiliatePayoutPath("aff1/../../secret.txt")).toThrow(
      "Caminho inválido",
    );
  });
});
