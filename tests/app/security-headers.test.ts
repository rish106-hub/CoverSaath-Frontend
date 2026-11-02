import { describe, expect, it } from "vitest";
import config from "../../next.config";
import { GET } from "@/app/api/health/route";

async function headersFor(source: string) {
  const rules = await config.headers!();
  return Object.fromEntries(rules.filter((r) => r.source === source).flatMap((r) => r.headers.map((h) => [h.key, h.value])));
}

describe("security headers", () => {
  it("sets the hardening headers on every route", async () => {
    const h = await headersFor("/:path*");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("keeps microphone and geolocation for the app and denies the rest", async () => {
    const h = await headersFor("/:path*");
    expect(h["Permissions-Policy"]).toContain("microphone=(self)");
    expect(h["Permissions-Policy"]).toContain("geolocation=(self)");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });

  it("CSP is same-origin, blocks framing and plugins", async () => {
    const csp = (await headersFor("/:path*"))["Content-Security-Policy"]!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toMatch(/https?:\/\/\*/);
  });

  it("never caches API responses", async () => {
    expect((await headersFor("/api/:path*"))["Cache-Control"]).toBe("no-store");
  });
});

describe("GET /api/health", () => {
  it("returns ok without touching the backend", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
