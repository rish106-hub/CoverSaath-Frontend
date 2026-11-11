import type * as S from "./schemas";
import type { ReferenceProducts, ReferenceQuery } from "./reference-contract";
import type { MemberAdapter, ScenarioAdapter } from "./scenarios";
import type { HospitalView, ThreadView, TurnEvent, TurnInput } from "./chat-contract";
import type { Candidates, Confirmed, ConfirmProduct, Conflicts, DeclarationInput, DeclarationView, Facts, HoldingView, PremiumInput, PremiumView, ResolveConflict, Resolved } from "./covers-contract";
import type { AskQuestion, CatalogueReview, ConfirmPolicyProfile, CoveragePreview, HandoffQuery, PassThrough } from "./evidence-contract";

export class AdapterError extends Error {
  constructor(public code: string, public retryable = false) {
    super(code);
    this.name = "AdapterError";
  }
}

export interface AuthAdapter {
  signInWithProvider(provider: "google" | "apple"): Promise<S.AuthResult>;
  sendOtp(mobile: string): Promise<S.AuthResult>;
  verifyOtp(mobile: string, code: string): Promise<S.AuthResult>;
  sendEmailLink(email: string): Promise<S.AuthResult>;
}
export interface AccessAdapter {
  submit(input: S.AccessInput): Promise<S.AccessResult>;
  signOut(): Promise<void>;
}
export interface HouseholdAdapter {
  /** The signed-in person and household, or null when nobody is signed in. Throws AdapterError when the backend is unreachable. */
  me(): Promise<S.Me | null>;
  /** Household with its members. With the backend: the owner plus the stored members only. With the mock adapters: the invented Rao family. */
  household(): Promise<S.Household>;
}
export interface DocumentAdapter {
  list(): Promise<S.DocumentItem[]>;
  add(name: string): Promise<S.DocumentItem>;
}
export interface ReadingAdapter {
  findings(policyId: string): Promise<S.Finding[]>;
}
export interface PolicyAdapter {
  list(): Promise<S.Policy[]>;
  get(id: string): Promise<S.Policy | null>;
}
export interface AssistantAdapter {
  ask(text: string, page: string): Promise<S.AssistantReply>;
}
export interface VoiceAdapter {
  supported(): boolean;
  listen(): Promise<string>;
  /** Ends listening early; listen() then resolves with what was heard. */
  stop?(): void;
  /** Shown beside the microphone when audio leaves the browser. FOR LEGAL REVIEW. */
  notice?: string;
}
export interface EmailAdapter {
  scan(): Promise<S.EmailScan>;
}
export interface ReconcileAdapter {
  reconcile(receipts: S.Receipt[]): Promise<S.ReconcileResult>;
}
export interface DeskAdapter {
  cases(): Promise<S.DeskCase[]>;
  /** Cases with steps, thread and escalation rung (W5). */
  board(): Promise<S.DeskBoardCase[]>;
}
export interface HospitalAdapter {
  nearby(): Promise<S.Hospital[]>;
  /** Ranked list for an issue, cashless on the person's plan or best treatment (W5). */
  ranked(issue: string, mode: "cashless" | "best"): Promise<S.RankedHospital[]>;
}
export interface BloodAdapter {
  stock(): Promise<S.BloodStock[]>;
  /** Units per blood group within 10 km (W5). */
  groups(): Promise<Record<string, number>>;
  banks(group: string): Promise<S.BloodBank[]>;
}
export interface LearnAdapter {
  posts(): Promise<S.LearnPost[]>;
}
export interface InviteAdapter {
  invite(input: S.InviteInput): Promise<{ ok: boolean; state: "joined" | "sent" | "none" }>;
  /** Saves a member's details. */
  updateMember(input: S.MemberUpdate): Promise<S.MemberUpdate>;
}
export interface WalletAdapter {
  detect(): S.WalletPlatform;
  pass(platform: S.WalletPlatform): Promise<S.WalletPass>;
}
export interface NotifyAdapter {
  send(channel: S.NotifyChannel, subject: string): Promise<S.NotifyResult>;
}

export interface ProfileAdapter {
  get(): Promise<S.Profile>;
  saveContact(input: { mobile: string }): Promise<{ mobile: string }>;
  saveAddress(address: S.AddressInput, source?: "user_typed" | "digilocker"): Promise<S.Address>;
  deleteAddress(): Promise<void>;
  /** Returns the address held in the person's DigiLocker. Throws AdapterError when it cannot be reached. */
  fetchAddressFromDigiLocker(): Promise<S.Address>;
  setPermission(permission: S.PermissionName, state: S.PermissionState, surface: S.PermissionSurface): Promise<void>;
  /** `coarse` positions are rounded to 2 decimals (about 1 km) and kept 24 hours. */
  saveCurrentLocation(input: { lat: number; lng: number; accuracyM: number; precision: "exact" | "coarse" }): Promise<S.CurrentLocation>;
  clearCurrentLocation(): Promise<void>;
  savePlace(kind: S.PlaceKind, label: string, address: S.PlaceAddress): Promise<S.SavedPlace>;
  deletePlace(id: string): Promise<void>;
}

// ---- User data that the backend stores (ADR 0015): Settings, onboarding ------------------------------------------------------

/** Settings as the page holds them. The adapter maps this to the backend preference document. */
export type UiPrefs = {
  sources: Record<string, boolean>;
  notify: Record<string, boolean>;
  sharing: Record<string, boolean>;
  voice: "en" | "hi" | "both";
  reduced: boolean;
  theme: "light" | "dark";
};
export interface PreferencesAdapter {
  /** Stored settings, or null when nothing was saved yet. */
  get(): Promise<UiPrefs | null>;
  /** Saves every setting. Rejects with AdapterError; the caller keeps what the person chose. */
  save(prefs: UiPrefs): Promise<UiPrefs>;
  /** Changes one setting on top of what is stored (used where the page does not hold all settings, such as the theme toggle). */
  update(patch: Partial<UiPrefs>): Promise<UiPrefs>;
}
export type UiOnboarding = {
  step?: number;
  way?: "dl" | "up" | "hr" | "no";
  /** M, R, K, A: the person toggles on the people step. */
  people?: Record<string, boolean>;
  wallet?: "apple" | "google" | "none" | "later";
  completed: boolean;
};
export interface OnboardingAdapter {
  get(): Promise<UiOnboarding | null>;
  /** Replaces the stored progress with `next`. */
  save(next: UiOnboarding): Promise<UiOnboarding>;
}

export interface ReferenceAdapter {
  /** Public product reference context (never the person's own cover). Rejects with AdapterError; REFERENCE_UNAVAILABLE means the reference data is not configured or stale. */
  products(query: ReferenceQuery): Promise<ReferenceProducts>;
}

export interface EvidenceAdapter {
  /** What a document is, as the backend proposes it. Unverified until the owner confirms. Rejects with AdapterError. */
  policyProfile(documentId: string): Promise<PassThrough>;
  /** `key` is reused when the same statement is repeated, so a retry cannot record it twice. */
  confirmPolicyProfile(documentId: string, statement: ConfirmPolicyProfile, key: string): Promise<PassThrough>;
  ask(caseId: string, input: AskQuestion, key: string): Promise<PassThrough>;
  answer(caseId: string, answerId: string): Promise<PassThrough>;
  handoff(caseId: string, query: HandoffQuery): Promise<PassThrough>;
  review(caseId: string, input: CatalogueReview, key: string): Promise<PassThrough>;
  designateConfirmer(adultUserId: string): Promise<PassThrough>;
  preview(body: CoveragePreview): Promise<PassThrough>;
  sourcePack(caseId: string): Promise<PassThrough>;
  deletionInventory(caseId: string): Promise<PassThrough>;
  integrations(): Promise<PassThrough>;
}

/** The cover screens: add a cover, say which product it is, read the facts, settle conflicts, declarations and premiums. */
export interface CoversAdapter {
  /** Adds one PDF (up to 4 MB). `key` is reused on a retry. Resolves with the holding once the backend has made it (null while it has not). */
  upload(file: File, key: string): Promise<{ documentId: string; holdingId: string | null }>;
  holdings(): Promise<HoldingView[]>;
  candidates(holdingId: string): Promise<Candidates>;
  confirmProduct(holdingId: string, statement: ConfirmProduct, key: string): Promise<Confirmed>;
  facts(holdingId: string): Promise<Facts>;
  conflicts(holdingId: string): Promise<Conflicts>;
  resolveConflict(holdingId: string, conflictId: string, choice: ResolveConflict): Promise<Resolved>;
  declarations(): Promise<DeclarationView[]>;
  addDeclaration(input: DeclarationInput): Promise<DeclarationView>;
  premiums(): Promise<PremiumView[]>;
  addPremium(input: PremiumInput): Promise<PremiumView>;
  /** Network hospitals of one cover for a six-digit pincode. The backend route is pending (S-C2). */
  hospitals(holdingId: string, pincode: string): Promise<HospitalView[]>;
}

/** Chat about the household's cover: a thread, then streamed turns. The browser never sees the backend token or calls the backend. */
export interface ChatAdapter {
  /** Opens a thread, optionally about one cover. Rejects with AdapterError. */
  startThread(holdingId?: string): Promise<ThreadView>;
  /** Sends one turn and calls `onEvent` for each streamed event (meta, delta, answer, then done). Resolves after `done`; rejects with AdapterError if the turn fails or the stream stops early. Aborting `signal` ends it quietly. */
  turn(threadId: string, input: TurnInput, onEvent: (e: TurnEvent) => void, signal?: AbortSignal): Promise<void>;
}

export type Adapters = {
  auth: AuthAdapter;
  access: AccessAdapter;
  household: HouseholdAdapter;
  document: DocumentAdapter;
  reading: ReadingAdapter;
  policy: PolicyAdapter;
  assistant: AssistantAdapter;
  voice: VoiceAdapter;
  email: EmailAdapter;
  reconcile: ReconcileAdapter;
  desk: DeskAdapter;
  hospital: HospitalAdapter;
  blood: BloodAdapter;
  learn: LearnAdapter;
  invite: InviteAdapter;
  wallet: WalletAdapter;
  notify: NotifyAdapter;
  profile: ProfileAdapter;
  preferences: PreferencesAdapter;
  onboarding: OnboardingAdapter;
  scenarios: ScenarioAdapter;
  members: MemberAdapter;
  reference: ReferenceAdapter;
  evidence: EvidenceAdapter;
  covers: CoversAdapter;
  chat: ChatAdapter;
};

export * from "./uploads";
