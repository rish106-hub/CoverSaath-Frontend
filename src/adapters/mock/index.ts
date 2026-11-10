import type { Adapters } from "../types";
import { AdapterError } from "../types";
import { detectWalletPlatform } from "@/lib/wallet-detect";
import { delay } from "./delay";
import { mockProfile } from "./profile";
import { mockPreferences, mockOnboarding } from "./user-data";
import { mockReference } from "./reference";
import { mockMembers, mockScenarios } from "./scenarios";
import { respond } from "@/agent/responder";
import { webVoice } from "@/agent/voice";
import { summariseReceipts } from "@/lib/reconcile";
import { deskBoard, rankHospitals, bloodGroups, bloodBanks } from "@/data/mock/help-pages";
import { household, policies, receipts, deskCases, hospitals, bloodStock, learnPosts, findings, documents } from "@/data/mock";

// Everything here is a mock. `// backend gap` marks what the backend has no tables for yet.

let signedInName: string | null = null;

export const mockAdapters: Adapters = {
  auth: {
    signInWithProvider: () => delay({ ok: true }),
    sendOtp: () => delay({ ok: true, message: "Code sent" }),
    verifyOtp: (_m, code) => delay(code.length === 6 ? { ok: true } : { ok: false, message: "Enter all 6 digits" }),
    sendEmailLink: () => delay({ ok: true, message: "Check your inbox" }),
  },
  access: {
    submit: async (input) => {
      signedInName = input.name.split(" ")[0] ?? input.name;
      return delay({ ok: true, name: signedInName });
    },
    signOut: async () => {
      signedInName = null;
    },
  },
  household: {
    me: () =>
      delay({
        householdId: household.id,
        householdName: household.displayName,
        owner: { id: "meera", displayName: signedInName ?? "Meera Rao", email: "meera.rao@company.com" },
        source: "mock" as const,
      }),
    household: () => delay(household), // backend gap: members beyond the owner
  },
  document: {
    list: () => delay(documents), // backend gap
    add: (name) => delay({ id: `d${documents.length + 1}`, name, status: "received" as const }),
  },
  reading: { findings: (id) => delay(findings.filter((f) => f.policyId === id)) }, // backend gap
  policy: {
    list: () => delay(policies), // backend gap
    get: (id) => delay(policies.find((p) => p.id === id) ?? null),
  },
  assistant: {
    ask: (text, page) => delay(respond(text, page)),
  },
  voice: webVoice,
  email: { scan: () => delay({ found: receipts.length, items: receipts }) }, // backend gap
  reconcile: {
    reconcile: (rs) => delay(summariseReceipts(rs)),
  },
  desk: { cases: () => delay(deskCases), board: () => delay(deskBoard) }, // backend gap
  hospital: { nearby: () => delay(hospitals), ranked: (issue, mode) => delay(rankHospitals(issue, mode)) }, // backend gap
  blood: {
    stock: () => delay(bloodStock),
    groups: () => delay(bloodGroups),
    banks: (group) => delay(bloodBanks(group)),
  }, // backend gap
  learn: { posts: () => delay(learnPosts) }, // backend gap
  invite: {
    invite: () => delay({ ok: true, state: "sent" as const }),
    updateMember: (input) => delay(input), // backend gap: mobile, e-mail and channel have no backend field
  },
  wallet: {
    detect: () => detectWalletPlatform(typeof navigator === "undefined" ? "" : navigator.userAgent),
    pass: (platform) => delay({ platform, label: "Meera Rao e-card", url: `/cards?pass=${platform}` }),
  },
  notify: {
    send: (channel, subject) =>
      delay(
        channel === "google-calendar"
          ? { ok: true, message: "Opening Google Calendar", url: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(subject)}` }
          : { ok: true, message: channel === "apple-calendar" ? "Calendar file ready" : "We will tell you when it moves" },
      ),
  },
  profile: mockProfile,
  preferences: mockPreferences,
  onboarding: mockOnboarding,
  scenarios: mockScenarios,
  members: mockMembers,
  reference: mockReference,
};
