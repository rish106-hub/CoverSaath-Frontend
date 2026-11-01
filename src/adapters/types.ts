import type * as S from "./schemas";

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
  /** Household with all members (members beyond the owner are mock: backend gap). */
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
};
