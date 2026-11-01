/* Frontend <-> backend <-> database dry run (BUILD-SPEC section 13). Server-side only; prints pass/fail, never tokens. */
import { existsSync } from "node:fs";
import { createBackendClient } from "../src/server/backend/client";
import { loadConfig, missingEnv } from "../src/server/backend/env";
import { grantAccess, readMe, readStatus } from "../src/server/backend/service";
import { open, seal } from "../src/server/backend/session";
import { AppError } from "../src/server/backend/errors";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

let failed = 0;
async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const note = await fn();
    console.log(`PASS  ${name}${note ? `  (${note})` : ""}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  ${name}  (${e instanceof AppError ? e.code : e instanceof Error ? e.message : "error"})`);
  }
}
const must = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

async function main() {
  const missing = missingEnv();
  if (missing.length > 0) {
    console.log(`SKIP  live run: set these names in .env.local: ${missing.join(", ")}`);
    process.exit(2);
  }
  const config = loadConfig();
  const client = createBackendClient({ baseUrl: config.apiUrl, bootstrapToken: config.bootstrapToken });
  let session!: Awaited<ReturnType<typeof grantAccess>>["session"];

  await step("backend health and readiness", async () => {
    const s = await readStatus(client);
    must(s.health && s.ready, `health=${s.health} ready=${s.ready}`);
  });
  await step("create household for Meera Rao (POST /households)", async () => {
    const r = await grantAccess(client, { name: "Meera Rao", email: "meera.rao@company.com" });
    session = r.session;
    must(r.firstName === "Meera", "first name");
    return `household ${session.h}`;
  });
  await step("sealed cookie round trip", async () => {
    const back = open(seal(session, config.cookieSecret), config.cookieSecret);
    must(back?.h === session.h && back.t === session.t, "mismatch");
    must(open(seal(session, config.cookieSecret), "a-different-secret-of-32-characters!!") === null, "wrong key accepted");
  });
  await step("read owner back from the backend (GET /households/{id})", async () => {
    const me = await readMe(client, session);
    must(me.owner.displayName === "Meera Rao", `got "${me.owner.displayName}"`);
    return `owner ${me.owner.displayName}`;
  });
  await step("connected sources (GET /integrations)", async () => {
    await client.integrations(session.t);
  });
  await step("sign out revokes the session", async () => {
    await client.revoke(session.t);
    try {
      await client.household(session.t, session.h);
    } catch (e) {
      must(e instanceof AppError && e.code === "UNAUTHENTICATED", "still readable");
      return;
    }
    throw new Error("session still valid after revoke");
  });
  await step("backend down gives a coded error, not a crash", async () => {
    const dead = createBackendClient({ baseUrl: "http://127.0.0.1:1", bootstrapToken: "x", timeoutMs: 1500 });
    try {
      await dead.health();
    } catch (e) {
      must(e instanceof AppError && e.retryable, "expected retryable coded error");
      return (e as AppError).code;
    }
    throw new Error("expected failure");
  });

  console.log(failed === 0 ? "\nDRY RUN: PASS" : `\nDRY RUN: FAIL (${failed} step(s))`);
  process.exit(failed === 0 ? 0 : 1);
}
void main();
