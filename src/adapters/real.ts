import type { Adapters, AssistantAdapter, BloodAdapter, DeskAdapter, DocumentAdapter, EmailAdapter, HospitalAdapter, InviteAdapter, LearnAdapter, PolicyAdapter, ReadingAdapter, WalletAdapter } from "./types";
import { AdapterError } from "./types";
import { backendAccess, backendHousehold } from "./backend";
import { backendOnboarding, backendPreferences, backendProfile } from "./user-data";
import { backendMembers, backendScenarios } from "./scenarios";
import { mockAdapters } from "./mock";
import { backendReference } from "./reference";
import { backendEvidence } from "./evidence";
import { backendAssistant } from "./chat";
import { createGnaniVoice } from "@/agent/voice-gnani";
import { detectWalletPlatform } from "@/lib/wallet-detect";

// The real pathway: every account except the one demo login. Features the backend has no tables for yet answer with honest
// empty collections, never with mock people, policies or money. `// backend gap` marks each one.

const none = <T>(v: T) => Promise.resolve(v);
const notYet = (): never => {
  throw new AdapterError("NOT_AVAILABLE");
};

export const emptyDocument: DocumentAdapter = { list: () => none([]), add: async () => notYet() }; // backend gap: the upload work replaces this
export const emptyReading: ReadingAdapter = { findings: () => none([]) }; // backend gap
export const emptyPolicy: PolicyAdapter = { list: () => none([]), get: () => none(null) }; // backend gap
export const emptyAssistant: AssistantAdapter = {
  ask: () =>
    none({
      reply: "Add your first policy and I can answer from it. Until then I have nothing of yours to read.",
      steps: ["Open My policies", "Upload your policy", "Ask me again"],
      route: "/policies",
      goLabel: "Upload your policy",
    }),
};
export const emptyEmail: EmailAdapter = { scan: () => none({ found: 0, items: [] }) }; // backend gap
export const emptyDesk: DeskAdapter = { cases: () => none([]), board: () => none([]) }; // backend gap
export const emptyHospital: HospitalAdapter = { nearby: () => none([]), ranked: () => none([]) }; // backend gap
export const emptyBlood: BloodAdapter = { stock: () => none([]), groups: () => none({}), banks: () => none([]) }; // backend gap
export const emptyLearn: LearnAdapter = { posts: () => none([]) }; // backend gap
export const emptyInvite: InviteAdapter = { invite: async () => notYet(), updateMember: async () => notYet() }; // backend gap
export const emptyWallet: WalletAdapter = {
  detect: () => detectWalletPlatform(typeof navigator === "undefined" ? "" : navigator.userAgent),
  pass: async () => notYet(), // backend gap: no e-card without a stored policy
};

export const realAdapters: Adapters = {
  auth: mockAdapters.auth, // sign-in providers are not wired; the beta access card is the real way in
  access: backendAccess,
  household: backendHousehold,
  document: emptyDocument,
  reading: emptyReading,
  policy: emptyPolicy,
  assistant: backendAssistant, // answers from stored evidence, cited; with none it says so
  voice: createGnaniVoice({ getLanguage: () => backendPreferences.get().then((p) => p?.voice) }), // Gnani via the BFF, browser speech as the fallback
  email: emptyEmail,
  reconcile: mockAdapters.reconcile, // pure arithmetic on what it is given
  desk: emptyDesk,
  hospital: emptyHospital,
  blood: emptyBlood,
  learn: emptyLearn,
  invite: emptyInvite,
  wallet: emptyWallet,
  notify: mockAdapters.notify, // calendar links only
  profile: backendProfile,
  preferences: backendPreferences,
  onboarding: backendOnboarding,
  scenarios: backendScenarios,
  members: backendMembers,
  reference: backendReference,
  evidence: backendEvidence,
};
