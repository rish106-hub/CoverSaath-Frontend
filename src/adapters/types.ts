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
}
export interface HospitalAdapter {
  nearby(): Promise<S.Hospital[]>;
}
export interface BloodAdapter {
  stock(): Promise<S.BloodStock[]>;
}
export interface LearnAdapter {
  posts(): Promise<S.LearnPost[]>;
}
export interface InviteAdapter {
  invite(input: S.InviteInput): Promise<{ ok: boolean; state: "joined" | "sent" | "none" }>;
}
export interface WalletAdapter {
  detect(): S.WalletPlatform;
  pass(platform: S.WalletPlatform): Promise<S.WalletPass>;
}
export interface NotifyAdapter {
  send(channel: S.NotifyChannel, subject: string): Promise<S.NotifyResult>;
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
};
