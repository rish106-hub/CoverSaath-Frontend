"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { adapters, type Me } from "@/adapters";

export type MeState = { status: "loading" } | { status: "ready"; me: Me } | { status: "signed-out" } | { status: "down" };

/** How long a good answer is reused, and the minimum gap between focus revalidations. */
export const ME_TTL_MS = 30_000;

const LOADING: MeState = { status: "loading" };
let snapshot: MeState = LOADING;
let fetchedAt = 0; // last successful answer
let attemptedAt = 0; // last request start (throttles focus revalidation)
let inflight = false;
let seq = 0;
const listeners = new Set<() => void>();

function emit(next: MeState) {
  snapshot = next;
  listeners.forEach((l) => l());
}

/**
 * Fetches once at a time. `force` (retry) starts a new request and orphans any older one: only the
 * newest sequence number may write state, so a slow stale response cannot overwrite a fresh one.
 */
function load(force: boolean, silent: boolean) {
  if (inflight && !force) return;
  const id = ++seq;
  inflight = true;
  attemptedAt = Date.now();
  if (!silent) emit(LOADING);
  adapters.household
    .me()
    .then((me) => {
      if (id !== seq) return;
      inflight = false;
      fetchedAt = Date.now();
      emit(me ? { status: "ready", me } : { status: "signed-out" });
    })
    .catch(() => {
      if (id !== seq) return;
      inflight = false;
      // A failed background refresh keeps the last good answer on screen.
      if (silent && snapshot.status === "ready") return;
      emit({ status: "down" });
    });
}

function ensureFresh() {
  if (inflight) return;
  const age = Date.now() - fetchedAt;
  if (fetchedAt === 0) load(false, false);
  else if (age >= ME_TTL_MS) load(false, true);
}

function onFocus() {
  if (inflight || Date.now() - attemptedAt < ME_TTL_MS) return;
  load(false, true);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("focus", onFocus);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("focus", onFocus);
  };
}

/** Forget the cached person (after sign-in or sign-out, and in tests). Orphans any request in flight. */
export function invalidateMe() {
  seq++;
  inflight = false;
  fetchedAt = 0;
  attemptedAt = 0;
  emit(LOADING);
}

/** Reads the signed-in person via one shared store, so many components cost one request per 30 s. */
export function useMe(): { state: MeState; retry: () => void } {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => LOADING);
  useEffect(() => {
    ensureFresh();
  }, []);
  const retry = useCallback(() => load(true, false), []);
  return { state, retry };
}
