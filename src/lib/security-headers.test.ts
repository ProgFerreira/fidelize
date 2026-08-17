import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { comHeadersSeguranca } from "./security-headers";

describe("comHeadersSeguranca", () => {
  it("aplica os headers básicos em qualquer rota", () => {
    const res = comHeadersSeguranca(NextResponse.next(), "/dashboard");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("Permissions-Policy")).toContain("camera=(self)");
  });

  it("bloqueia framing fora do widget", () => {
    const res = comHeadersSeguranca(NextResponse.next(), "/dashboard");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'self'",
    );
  });

  it("não bloqueia framing do widget (precisa ser embedável)", () => {
    const res = comHeadersSeguranca(NextResponse.next(), "/embed/widget");
    expect(res.headers.get("X-Frame-Options")).toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
