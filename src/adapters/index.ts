import type { Adapters } from "./types";
import { mockAdapters } from "./mock";
import { backendAccess, backendHousehold } from "./backend";
import { backendOnboarding, backendPreferences, backendProfile } from "./user-data";

// Active adapter set. Access and household talk to the real backend through the BFF unless
// NEXT_PUBLIC_ADAPTERS=mock (or under test). Profile, preferences and onboarding use the user-data store (ADR 0015). Everything else is mock until the backend has tables.
const useBackend = process.env.NEXT_PUBLIC_ADAPTERS !== "mock" && process.env.NODE_ENV !== "test";

export const adapters: Adapters = {
  ...mockAdapters,
  access: useBackend ? backendAccess : mockAdapters.access,
  household: useBackend ? backendHousehold : mockAdapters.household,
  profile: useBackend ? backendProfile : mockAdapters.profile,
  preferences: useBackend ? backendPreferences : mockAdapters.preferences,
  onboarding: useBackend ? backendOnboarding : mockAdapters.onboarding,
};

export * from "./types";
export * from "./schemas";
