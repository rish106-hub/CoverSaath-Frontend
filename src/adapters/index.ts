import type { Adapters } from "./types";
import { mockAdapters } from "./mock";
import { backendAccess, backendHousehold } from "./backend";
import { backendOnboarding, backendPreferences, backendProfile } from "./user-data";
import { backendMembers, backendScenarios } from "./scenarios";
import { useBackend } from "./mode";

// Active adapter set. Access and household talk to the real backend through the BFF unless
// NEXT_PUBLIC_ADAPTERS=mock (or under test). Profile, preferences and onboarding use the user-data store (ADR 0015). Everything else is mock until the backend has tables.
/** Google sign-in is shown only when the deploy has the server-side flow configured (set NEXT_PUBLIC_GOOGLE_SIGNIN=1 at build). */
export const googleSignIn = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1";
export const usingBackend = useBackend;

export const adapters: Adapters = {
  ...mockAdapters,
  access: useBackend ? backendAccess : mockAdapters.access,
  household: useBackend ? backendHousehold : mockAdapters.household,
  profile: useBackend ? backendProfile : mockAdapters.profile,
  preferences: useBackend ? backendPreferences : mockAdapters.preferences,
  onboarding: useBackend ? backendOnboarding : mockAdapters.onboarding,
  scenarios: useBackend ? backendScenarios : mockAdapters.scenarios,
  members: useBackend ? backendMembers : mockAdapters.members,
};

export { features } from "./features";
export * from "./types";
export * from "./schemas";
