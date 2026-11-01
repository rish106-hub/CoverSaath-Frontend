import { z } from "zod";

export const inviteState = z.enum(["joined", "sent", "none"]);
export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  relation: z.enum(["self", "spouse", "child", "mother", "father", "other"]),
  age: z.number().int().nonnegative(),
  city: z.string().optional(),
  invite: inviteState,
});
export type Member = z.infer<typeof memberSchema>;

export const householdSchema = z.object({ id: z.string(), displayName: z.string(), members: z.array(memberSchema) });
export type Household = z.infer<typeof householdSchema>;

/** Who is signed in. From the backend when configured, else mock. */
export const meSchema = z.object({
  householdId: z.string(),
  householdName: z.string(),
  owner: z.object({ id: z.string(), displayName: z.string(), email: z.string().optional() }),
  source: z.enum(["backend", "mock"]),
});
export type Me = z.infer<typeof meSchema>;

export const accessInputSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254) });
export type AccessInput = z.infer<typeof accessInputSchema>;
export const accessResultSchema = z.object({ ok: z.boolean(), name: z.string().optional(), code: z.string().optional() });
export type AccessResult = z.infer<typeof accessResultSchema>;

export const authResultSchema = z.object({ ok: z.boolean(), message: z.string().optional() });
export type AuthResult = z.infer<typeof authResultSchema>;

export const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  insurer: z.string(),
  kind: z.enum(["group", "top-up", "senior", "individual"]),
  sumInsuredRs: z.number(),
  premiumRs: z.number(),
  coPayPct: z.number(),
  renewsOn: z.string(),
  memberIds: z.array(z.string()),
});
export type Policy = z.infer<typeof policySchema>;

export const findingSchema = z.object({ policyId: z.string(), label: z.string(), answer: z.string(), pageRef: z.string(), disagrees: z.boolean() });
export type Finding = z.infer<typeof findingSchema>;

export const documentSchema = z.object({ id: z.string(), name: z.string(), status: z.enum(["received", "reading", "read"]) });
export type DocumentItem = z.infer<typeof documentSchema>;

export const receiptSchema = z.object({ id: z.string(), memberId: z.string(), label: z.string(), amountRs: z.number(), date: z.string(), source: z.enum(["gmail", "upload"]) });
export type Receipt = z.infer<typeof receiptSchema>;

export const reconcileResultSchema = z.object({ matched: z.number(), duplicates: z.number(), refundRs: z.number() });
export type ReconcileResult = z.infer<typeof reconcileResultSchema>;

export const deskCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  status: z.enum(["In progress", "Needs you", "Scheduled", "Done"]),
  progress: z.number().min(0).max(100),
  eta: z.string(),
});
export type DeskCase = z.infer<typeof deskCaseSchema>;

export const hospitalSchema = z.object({ id: z.string(), name: z.string(), km: z.number(), cashless: z.boolean(), phone: z.string() });
export type Hospital = z.infer<typeof hospitalSchema>;

export const bloodSchema = z.object({ bank: z.string(), group: z.string(), units: z.number().int(), km: z.number() });
export type BloodStock = z.infer<typeof bloodSchema>;

export const learnPostSchema = z.object({ id: z.string(), kind: z.enum(["Video", "Guide", "News"]), title: z.string(), why: z.string(), minutes: z.number() });
export type LearnPost = z.infer<typeof learnPostSchema>;

export const assistantReplySchema = z.object({ reply: z.string(), steps: z.array(z.string()).length(3), route: z.string().optional() });
export type AssistantReply = z.infer<typeof assistantReplySchema>;

export const inviteInputSchema = z.object({ relation: z.string().min(1), name: z.string().min(1), mobile: z.string().regex(/^\+?\d[\d\s-]{7,14}$/), via: z.enum(["whatsapp", "sms"]) });
export type InviteInput = z.infer<typeof inviteInputSchema>;
export const inviteResultSchema = z.object({ ok: z.boolean(), state: inviteState });

export const walletPlatform = z.enum(["apple", "google", "samsung"]);
export type WalletPlatform = z.infer<typeof walletPlatform>;
export const walletPassSchema = z.object({ platform: walletPlatform, label: z.string(), url: z.string() });
export type WalletPass = z.infer<typeof walletPassSchema>;

export const notifyChannel = z.enum(["google-calendar", "apple-calendar", "whatsapp", "email"]);
export type NotifyChannel = z.infer<typeof notifyChannel>;
export const notifyResultSchema = z.object({ ok: z.boolean(), message: z.string(), url: z.string().optional() });
export type NotifyResult = z.infer<typeof notifyResultSchema>;

export const emailScanSchema = z.object({ found: z.number().int(), items: z.array(receiptSchema) });
export type EmailScan = z.infer<typeof emailScanSchema>;

export const healthSchema = z.object({ ok: z.boolean(), health: z.boolean(), ready: z.boolean(), householdId: z.string().optional() });
export type BackendStatus = z.infer<typeof healthSchema>;

// W5 (help): richer desk, emergency and blood shapes. Appended.
export const deskBoardCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  who: z.string(),
  amount: z.string(),
  next: z.string(),
  ref: z.string(),
  /** 0 Raised, 1 With TPA, 2 Documents, 3 Resolved. */
  stage: z.number().int().min(0).max(3),
  stateLabel: z.string(),
  /** Escalation rung in progress, or -1 when no escalation is needed. */
  rung: z.number().int().min(-1).max(3),
  thread: z.array(z.object({ from: z.string(), at: z.string(), text: z.string(), side: z.enum(["knowvia", "other", "you"]) })),
  docs: z.array(z.object({ name: z.string(), highlighted: z.boolean() })),
});
export type DeskBoardCase = z.infer<typeof deskBoardCaseSchema>;

export const rankedHospitalSchema = z.object({
  pin: z.string(), name: z.string(), distance: z.string(), why: z.string(), tag: z.string(), x: z.number(), y: z.number(), top: z.boolean(),
});
export type RankedHospital = z.infer<typeof rankedHospitalSchema>;

export const bloodBankSchema = z.object({ name: z.string(), distance: z.string(), units: z.number().int() });
export type BloodBank = z.infer<typeof bloodBankSchema>;
