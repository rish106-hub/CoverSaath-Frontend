import type { Adapters } from "./types";
import { mockAdapters } from "./mock";
import { backendAccess, backendHousehold } from "./backend";
import { backendOnboarding, backendPreferences, backendProfile } from "./user-data";
import { backendMembers, backendScenarios } from "./scenarios";
import { useBackend } from "./mode";
import { isDemoSession } from "./demo";

// Active adapter set. Access and household talk to the real backend through the BFF unless
// NEXT_PUBLIC_ADAPTERS=mock (or under test). Profile, preferences and onboarding use the user-data store (ADR 0015). Everything else is mock until the backend has tables.
/** Google sign-in is shown only when the deploy has the server-side flow configured (set NEXT_PUBLIC_GOOGLE_SIGNIN=1 at build). */
export const googleSignIn = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1";
export const usingBackend = useBackend;

const real: Adapters = {
  ...mockAdapters,
  access: useBackend ? backendAccess : mockAdapters.access,
  household: useBackend ? backendHousehold : mockAdapters.household,
  profile: useBackend ? backendProfile : mockAdapters.profile,
  preferences: useBackend ? backendPreferences : mockAdapters.preferences,
  onboarding: useBackend ? backendOnboarding : mockAdapters.onboarding,
  scenarios: useBackend ? backendScenarios : mockAdapters.scenarios,
  members: useBackend ? backendMembers : mockAdapters.members,
};

/**
 * Per call, a demo session (marker cookie) is served by the mock adapters instead of the BFF ones. Non-demo sessions always get
 * `real`, unchanged. `access` stays real so sign-out reaches the server and clears the demo cookie.
 */
function demoSwitch(): Adapters {
  const out = { ...real };
  for (const k of Object.keys(real) as (keyof Adapters)[]) {
    if (k === "access" || real[k] === mockAdapters[k]) continue;
    out[k] = new Proxy(real[k] as object, {
      get(_t, prop) {
        const target = (isDemoSession() ? mockAdapters[k] : real[k]) as unknown as Record<PropertyKey, unknown>;
        const v = target[prop];
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    }) as never;
  }
  return out;
}

export const adapters: Adapters = useBackend ? demoSwitch() : real;

export { features } from "./features";
export * from "./types";
export * from "./schemas";
