import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS, isEventName, sanitizeProperties } from "@/server/analytics/policy";
import { analyticsConfig } from "@/server/analytics/config";
import { parseConsent } from "@/server/analytics/consent";
import { POST as ingest } from "@/app/api/app/ingest/route";
import { POST as consent } from "@/app/api/app/analytics/consent/route";

const ID = "a".repeat(32);
const env = { ANALYTICS_ENABLED: "1", POSTHOG_PROJECT_KEY: "test-key", POSTHOG_HOST: "https://eu.i.posthog.com" };
const req = (url: string, body: unknown, cookie?: string) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "x-knowvia-app": "1", host: "localhost", "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ev = { event: "page_view", properties: { page: "home", theme: "dark" } };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const on = () => Object.entries(env).forEach(([k, v]) => vi.stubEnv(k, v));

describe("allow-list", () => {
  it("keeps declared enum and boolean values only", () => {
    expect(sanitizeProperties("page_view", { page: "home", theme: "dark", viewport: "large" })).toEqual({ page: "home", theme: "dark", viewport: "large" });
    expect(sanitizeProperties("action_failed", { page: "home", retryable: true })).toEqual({ page: "home", retryable: true });
  });
  it("drops unknown keys, free text, paths, identifiers and wrong types", () => {
    const out = sanitizeProperties("page_view", {
      page: "/policies/POL-123?pan=ABCDE1234F", theme: "dark", email: "a@b.in", household_id: "h1", name: "Asha", $ip: "1.2.3.4", viewport: 5,
    });
    expect(out).toEqual({ theme: "dark" });
    expect(sanitizeProperties("action_failed", { page: "home", retryable: "yes" })).toEqual({ page: "home" });
  });
  it("rejects non-objects and prototype tricks", () => {
    for (const v of [null, "x", 3, [], undefined]) expect(sanitizeProperties("page_view", v)).toEqual({});
    expect(sanitizeProperties("page_view", JSON.parse('{"__proto__":{"page":"home"}}'))).toEqual({});
  });
  it("only declared events pass, and no declared value looks like a free-text field", () => {
    expect(isEventName("page_view")).toBe(true);
    for (const bad of ["toString", "__proto__", "$autocapture", "click", 1, null]) expect(isEventName(bad)).toBe(false);
    for (const props of Object.values(EVENTS)) for (const key of Object.keys(props)) expect(key).not.toMatch(/id|name|email|phone|mobile|pan|aadhaar|policy|text|url|path|query/i);
  });
});

describe("flag", () => {
  it("is off unless exactly 1 with a project key and an allowed host", () => {
    expect(analyticsConfig({})).toBeNull();
    expect(analyticsConfig({ ...env, ANALYTICS_ENABLED: "true" })).toBeNull();
    expect(analyticsConfig({ ...env, POSTHOG_PROJECT_KEY: "" })).toBeNull();
    expect(analyticsConfig({ ...env, POSTHOG_HOST: "https://evil.example" })).toBeNull();
    expect(analyticsConfig(env)).toEqual({ key: "test-key", host: "https://eu.i.posthog.com" });
  });
  it("off: the route answers 204 and sends nothing, even with consent", async () => {
    const res = await ingest(req("/api/app/ingest", ev, `kv_analytics=granted.${ID}`));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("consent gate", () => {
  it("parses only well-formed granted cookies", () => {
    expect(parseConsent(`granted.${ID}`)).toEqual({ granted: true, id: ID });
    for (const v of [undefined, "", "denied", "granted", "granted.", "granted.xyz", `granted.${ID}x`]) expect(parseConsent(v)).toEqual({ granted: false });
  });
  it("no cookie or denied: nothing sent", async () => {
    on();
    for (const cookie of [undefined, "kv_analytics=denied", "kv_analytics=granted.bad", "kv_session=x"]) {
      expect((await ingest(req("/api/app/ingest", ev, cookie))).status).toBe(204);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("granted: forwards a scratch-built body with no cookies, ip or extra properties", async () => {
    on();
    const res = await ingest(req("/api/app/ingest", { ...ev, properties: { ...ev.properties, email: "a@b.in" }, distinct_id: "h1" }, `kv_analytics=granted.${ID}`));
    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
    expect(init.credentials).toBe("omit");
    const sent = JSON.parse(init.body as string);
    expect(sent.distinct_id).toBe(ID);
    expect(sent.properties).toEqual({ page: "home", theme: "dark", $process_person_profile: false, $geoip_disable: true, $lib: "knowvia-server-proxy" });
    expect(JSON.stringify(sent)).not.toMatch(/a@b\.in|h1/);
  });
  it("unknown event or oversized body is a 400; missing app header is 403; bad JSON is 400", async () => {
    on();
    const c = `kv_analytics=granted.${ID}`;
    expect((await ingest(req("/api/app/ingest", { event: "autocapture" }, c))).status).toBe(400);
    expect((await ingest(req("/api/app/ingest", "x".repeat(2000), c))).status).toBe(400);
    expect((await ingest(req("/api/app/ingest", "{", c))).status).toBe(400);
    const noHeader = new Request("http://localhost/api/app/ingest", { method: "POST", headers: { cookie: c, host: "localhost" }, body: "{}" });
    expect((await ingest(noHeader)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("a PostHog outage never breaks the caller", async () => {
    on();
    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect((await ingest(req("/api/app/ingest", ev, `kv_analytics=granted.${ID}`))).status).toBe(204);
  });
});

describe("consent route", () => {
  it("grant sets a non-essential HttpOnly cookie with a random id, keeping an existing id", async () => {
    const res = await consent(req("/api/app/analytics/consent", { choice: "granted" }));
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/^kv_analytics=granted\.[0-9a-f]{32};/);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(set).not.toMatch(/Domain/i);
    const again = await consent(req("/api/app/analytics/consent", { choice: "granted" }, `kv_analytics=granted.${ID}`));
    expect(again.headers.get("set-cookie")).toContain(`granted.${ID}`);
  });
  it("deny clears the cookie; bad choice is 400; no event is sent either way", async () => {
    const res = await consent(req("/api/app/analytics/consent", { choice: "denied" }, `kv_analytics=granted.${ID}`));
    expect(res.headers.get("set-cookie")).toMatch(/kv_analytics=;.*Max-Age=0/i);
    expect((await consent(req("/api/app/analytics/consent", { choice: "maybe" }))).status).toBe(400);
    expect((await consent(req("/api/app/analytics/consent", { choice: "granted", extra: 1 }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses the __Host- name over https", async () => {
    const r = new Request("https://app.example/api/app/analytics/consent", {
      method: "POST", headers: { "x-knowvia-app": "1", host: "app.example", "x-forwarded-proto": "https" }, body: JSON.stringify({ choice: "granted" }),
    });
    expect((await consent(r)).headers.get("set-cookie")).toMatch(/^__Host-kv_analytics=granted\./);
  });
});
