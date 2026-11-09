import type { Adapters } from "./types";
import { mockAdapters } from "./mock";
import { realAdapters } from "./real";
import { modeFromSource, resetSessionMode, resolveSessionMode, setSessionMode } from "./session-mode";

// Adapter set per session. Under test or NEXT_PUBLIC_ADAPTERS=mock everything is mock (as before). Otherwise the one demo
// session (demo@demo.com) gets the mock set and every other account gets the real set: real backend adapters, and honest
// empty collections where the backend has no tables yet (see ./real.ts). The choice is made on each call from the session.
export const usingBackend =
  process.env.NEXT_PUBLIC_ADAPTERS !== "mock" && process.env.NODE_ENV !== "test";

type Fn = (...args: unknown[]) => unknown;

/** Methods that answer from the device alone and so cannot wait on the session. */
const SYNC: Partial<Record<keyof Adapters, string[]>> = { wallet: ["detect"] };

/** Device-only or data-free adapters are shared and need no session lookup. */
const SHARED: (keyof Adapters)[] = ["auth", "voice", "reconcile", "notify"];

function switched<K extends keyof Adapters>(key: K, demo: Adapters[K], real: Adapters[K]): Adapters[K] {
  const d = demo as unknown as Record<string, unknown>;
  const r = real as unknown as Record<string, unknown>;
  const sync: string[] = SYNC[key] ?? [];
  return new Proxy({} as Adapters[K], {
    get(_t, prop: string) {
      if (sync.includes(prop)) return r[prop];
      if (typeof r[prop] !== "function") return r[prop];
      return async (...args: unknown[]) => {
        const set = (await resolveSessionMode()) === "demo" ? d : r;
        return (set[prop] as Fn).apply(set, args);
      };
    },
  });
}

/** Builds the per-session set from the demo (mock) and real sets. Exported for tests. */
export function buildAdapters(demo: Adapters = mockAdapters, real: Adapters = realAdapters): Adapters {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(demo) as (keyof Adapters)[]) out[k] = SHARED.includes(k) ? real[k] : switched(k, demo[k], real[k]);
  const sw = out as unknown as Adapters;
  const access = real.access;
  const household = sw.household;
  // Remember the mode as soon as sign-in or the person lookup says what it is. The BFF names the mode in `source`.
  sw.access = {
    async submit(input) {
      const res = await access.submit(input);
      if (res.ok) setSessionMode(res.demo ? "demo" : "real");
      return res;
    },
    async signOut() {
      try {
        await access.signOut();
      } finally {
        resetSessionMode();
      }
    },
  };
  sw.household = {
    async me() {
      const me = await real.household.me();
      if (me) setSessionMode(modeFromSource(me.source));
      else resetSessionMode();
      return me;
    },
    household: () => household.household(),
  };
  return sw;
}

export const adapters: Adapters = usingBackend ? buildAdapters() : mockAdapters;

export * from "./types";
export * from "./schemas";
