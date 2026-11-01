"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adapters } from "@/adapters";
import type { ScenarioAdapter, ScenarioTool } from "@/adapters/scenarios";
import type { SaveStatus } from "@/components/ui/SaveState";
import type { Codec } from "@/lib/scenario-codecs";

export const SAVE_DELAY_MS = 600;

type Options<T> = {
  tool: ScenarioTool;
  /** Everything the screen lets the person change. */
  value: T;
  codec: Codec<T>;
  /** Restores the saved values into the screen's state once, on mount. */
  apply: (saved: Partial<T>) => void;
  adapter?: ScenarioAdapter;
  delayMs?: number;
};

/**
 * Keeps one screen's inputs in the backend. Loads the saved inputs on mount and restores them; after that, every change is saved
 * 600 ms after the last one, one request at a time, with the revision last seen (a conflict reloads the revision and sends the
 * newest values). A failed save keeps the value on screen and offers a retry; leaving the page or the control sends what is pending.
 */
export function useScenario<T>({ tool, value, codec, apply, adapter = adapters.scenarios, delayMs = SAVE_DELAY_MS }: Options<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const s = useRef({
    value, apply, codec, adapter, tool, revision: undefined as number | undefined, saved: null as string | null, loaded: false, flying: null as Promise<void> | null,
    timer: null as ReturnType<typeof setTimeout> | null, mounted: true, initial: JSON.stringify(codec.encode(value)),
  });
  useEffect(() => {
    Object.assign(s.current, { value, apply, codec, adapter, tool });
  });

  const json = (v: T) => JSON.stringify(s.current.codec.encode(v));
  const show = (st: SaveStatus) => {
    if (s.current.mounted) setStatus(st);
  };

  const send = useCallback(async (): Promise<void> => {
    const c = s.current;
    if (c.flying) return c.flying;
    const run = async () => {
      show("saving");
      let attempts = 0;
      for (;;) {
        const body = json(c.value);
        try {
          const out = await c.adapter.save(c.tool, JSON.parse(body) as Record<string, unknown>, c.revision);
          c.revision = out.revision;
          c.saved = body;
          break;
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === "REVISION_CONFLICT" && attempts++ < 1) {
            try {
              c.revision = (await c.adapter.load(c.tool)).revision;
              continue;
            } catch {
              /* falls through to the error state */
            }
          }
          show("error");
          return;
        }
      }
      // Changed while the request was in the air: send the newest values too.
      if (json(c.value) !== c.saved) {
        c.timer = setTimeout(() => void flush(), delayMs);
        show("saving");
      } else show("saved");
    };
    c.flying = run().finally(() => {
      c.flying = null;
    });
    return c.flying;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);

  const flush = useCallback(async () => {
    const c = s.current;
    if (c.timer) clearTimeout(c.timer);
    c.timer = null;
    if (!c.loaded || json(c.value) === c.saved) return;
    await send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send]);

  // Load once.
  const load = useCallback(async () => {
    const c = s.current;
    show("idle");
    try {
      const rec = await c.adapter.load(c.tool);
      if (!c.mounted) return;
      c.revision = rec.revision;
      if (rec.inputs) {
        const restored = c.codec.decode(rec.inputs);
        c.apply(restored);
        c.saved = json({ ...c.value, ...restored });
      } else c.saved = c.initial;
      c.loaded = true;
      // Changed while loading: save it.
      if (json(c.value) !== c.saved && !c.timer) c.timer = setTimeout(() => void flush(), delayMs);
    } catch {
      show("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs]);
  useEffect(() => {
    const c = s.current;
    c.mounted = true;
    void load();
    return () => {
      c.mounted = false;
      if (c.timer) clearTimeout(c.timer);
      c.timer = null;
      // Leaving with a change not yet sent: send it now.
      if (c.loaded && JSON.stringify(c.codec.encode(c.value)) !== c.saved) {
        const body = JSON.parse(JSON.stringify(c.codec.encode(c.value))) as Record<string, unknown>;
        const after = c.flying ?? Promise.resolve();
        void after.then(() => c.adapter.save(c.tool, body, c.revision)).catch(() => undefined);
      }
    };
  }, [load]);

  // Schedule a save after each change.
  useEffect(() => {
    const c = s.current;
    if (!c.loaded) return;
    const now = JSON.stringify(c.codec.encode(value));
    if (now === c.saved) return;
    if (c.timer) clearTimeout(c.timer);
    c.timer = setTimeout(() => void flush(), delayMs);
  }, [value, delayMs, flush]);

  const retry = useCallback(() => {
    const c = s.current;
    if (!c.loaded) return void load();
    void flush();
  }, [load, flush]);

  return { status, retry, flush: useCallback(() => void flush(), [flush]) };
}
