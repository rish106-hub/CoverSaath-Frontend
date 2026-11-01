import type { OnboardingAdapter, PreferencesAdapter, UiOnboarding, UiPrefs } from "../types";
import { delay } from "./delay";

// backend gap: in memory for the visit. The real implementations are in ../user-data.ts.
const DEFAULTS: UiPrefs = {
  sources: { gmail: true, digilocker: true, abha: false },
  notify: { whatsapp: true, email: true, calendar: false },
  sharing: { rohan: true, mother: true, father: false },
  voice: "both",
  reduced: false,
  theme: "light",
};
let prefs: UiPrefs | null = null;
let onboarding: UiOnboarding | null = null;

export const mockPreferences: PreferencesAdapter = {
  get: () => delay(prefs ? structuredClone(prefs) : null),
  save: async (p) => {
    prefs = structuredClone(p);
    return delay(structuredClone(p));
  },
  update: async (patch) => {
    prefs = { ...(prefs ?? DEFAULTS), ...patch };
    return delay(structuredClone(prefs));
  },
};

export const mockOnboarding: OnboardingAdapter = {
  get: () => delay(onboarding ? structuredClone(onboarding) : null),
  save: async (next) => {
    onboarding = structuredClone(next);
    return delay(structuredClone(next));
  },
};

/** Test helper. */
export function resetMockUserData() {
  prefs = null;
  onboarding = null;
}
