import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/server/backend/session";

const SECRET = "s".repeat(40);
let cookieValue: string | undefined;
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined), set: () => {}, delete: () => {} }), headers: async () => ({ get: () => null }) }));

import { POST } from "@/app/api/app/voice/transcribe/route";
import { _resetVoiceLocks, checkWav } from "@/server/backend/gnani";
import { encodeWav } from "@/agent/voice-gnani";

const KEY = "gnani-secret-key-123";
const wav = (seconds = 1) => encodeWav(new Float32Array(Math.floor(16000 * seconds)).fill(0.1));
const req = (body: BodyInit | null = wav() as BodyInit, headers: Record<string, string> = {}) =>
  new Request("http://app.test/api/app/voice/transcribe", { method: "POST", headers: { host: "app.test", "x-knowvia-app": "1", "content-type": "audio/wav", "x-knowvia-language": "en-IN", ...headers }, body });

type Call = { url: string; headers: Record<string, string>; form: FormData };
let calls: Call[];
let up: { status: number; body: unknown } | "throw" | "hang";
const spies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  process.env.KNOWVIA_API_URL = "http://backend.test";
  process.env.KNOWVIA_BOOTSTRAP_TOKEN = "boot";
  process.env.SESSION_COOKIE_SECRET = SECRET;
  process.env.GNANI_API_KEY = KEY;
  cookieValue = seal({ t: "tok-123456789012345", h: "h1", m: "m1", exp: Date.now() + 60_000 }, SECRET);
  calls = [];
  up = { status: 200, body: { transcript: " is cataract covered ", language_code: "en-IN" } };
  _resetVoiceLocks();
  for (const m of ["log", "info", "warn", "error", "debug"] as const) spies.push(vi.spyOn(console, m).mockImplementation(() => {}));
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, form: init.body as FormData });
    if (up === "throw") throw new Error(`network down ${KEY} ${url}`);
    if (up === "hang") return new Promise<Response>(() => {});
    return new Response(JSON.stringify(up.body), { status: up.status });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  spies.splice(0).forEach((s) => s.mockRestore());
  delete process.env.GNANI_API_KEY;
});

describe("voice transcribe BFF", () => {
  it("sends multipart to Gnani with the key header and returns the transcript", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, transcript: "is cataract covered", language: "en-IN" });
    const c = calls[0] as Call;
    expect(c.url).toBe("https://api.vachana.ai/stt/v3");
    expect(c.headers["X-API-Key-ID"]).toBe(KEY);
    expect(c.form.get("language_code")).toBe("en-IN");
    expect(c.form.get("model")).toBe("prisma-v3.0");
    expect(c.form.get("format")).toBe("transcribe");
    expect(c.form.get("audio_file")).toBeInstanceOf(Blob);
  });
  it("answers 503 VOICE_NOT_CONFIGURED when the key is missing, without calling Gnani", async () => {
    delete process.env.GNANI_API_KEY;
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("VOICE_NOT_CONFIGURED");
    expect(calls).toHaveLength(0);
    process.env.GNANI_API_KEY = "   ";
    expect((await POST(req())).status).toBe(503);
  });
  it("refuses demo sessions, missing sessions and a missing app header", async () => {
    cookieValue = seal({ t: "", h: "demo", m: "m", exp: Date.now() + 60_000, demo: true }, SECRET);
    vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
    const d = await POST(req());
    expect(d.status).toBe(403);
    expect((await d.json()).code).toBe("DEMO_READ_ONLY");
    cookieValue = undefined;
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req(wav() as BodyInit, { "x-knowvia-app": "0" }))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("rejects oversize (413), wrong type (415), bad header and over-long audio", async () => {
    expect((await POST(req(new Uint8Array(2 * 1024 * 1024 + 1) as BodyInit))).status).toBe(413);
    expect((await POST(req(wav() as BodyInit, { "content-type": "audio/webm" }))).status).toBe(415);
    expect((await POST(req(new Uint8Array(100) as BodyInit))).status).toBe(400);
    expect((await POST(req(wav() as BodyInit, { "x-knowvia-language": "fr-FR" }))).status).toBe(400);
    const long = await POST(req(wav(31) as BodyInit));
    expect(long.status).toBe(413);
    expect(calls).toHaveLength(0);
    expect(checkWav(wav(30))).toBeCloseTo(30, 1);
    const stereo = wav();
    new DataView(stereo.buffer).setUint16(22, 2, true);
    expect(() => checkWav(stereo)).toThrow();
  });
  it("allows one request at a time per session (429 VOICE_BUSY) and frees the lock after", async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", () => new Promise<Response>((r) => { release = r; }));
    const first = POST(req());
    await new Promise((r) => setTimeout(r, 20));
    const second = await POST(req());
    expect(second.status).toBe(429);
    expect((await second.json()).code).toBe("VOICE_BUSY");
    release(new Response(JSON.stringify({ transcript: "ok" }), { status: 200 }));
    expect((await first).status).toBe(200);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ transcript: "again" }), { status: 200 }));
    expect((await POST(req())).status).toBe(200);
  });
  it("maps upstream errors without leaking bodies, and frees the lock after a failure", async () => {
    for (const [status, code, http] of [[401, "VOICE_UPSTREAM_FAILED", 502], [402, "VOICE_UPSTREAM_FAILED", 502], [403, "VOICE_UPSTREAM_FAILED", 502], [429, "VOICE_BUSY", 429], [504, "VOICE_UPSTREAM_FAILED", 502], [422, "VOICE_UPSTREAM_FAILED", 502]] as const) {
      up = { status, body: { error: "UPSTREAM SECRET BODY", key: KEY } };
      const res = await POST(req());
      const text = JSON.stringify(await res.json());
      expect(res.status).toBe(http);
      expect(text).toContain(code);
      expect(text).not.toContain("UPSTREAM SECRET");
      expect(text).not.toContain(KEY);
    }
    up = { status: 200, body: { nope: 1 } };
    expect((await POST(req())).status).toBe(502);
  });
  it("never leaks the key, URL or audio in errors or logs on a network failure", async () => {
    up = "throw";
    const res = await POST(req());
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(502);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("vachana");
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => JSON.stringify(c)).join("");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain("cataract");
  });
});
