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
  source: z.enum(["backend", "mock", "demo"]),
});
export type Me = z.infer<typeof meSchema>;

export const accessInputSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), password: z.string().max(200).optional() });
export type AccessInput = z.infer<typeof accessInputSchema>;
export const accessResultSchema = z.object({ ok: z.boolean(), name: z.string().optional(), code: z.string().optional(), demo: z.boolean().optional() });
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

export const assistantReplySchema = z.object({ reply: z.string(), steps: z.array(z.string()).length(3), route: z.string().optional(), goLabel: z.string().optional(), pageRef: z.string().optional() });
export type AssistantReply = z.infer<typeof assistantReplySchema>;

export const inviteInputSchema = z.object({ relation: z.string().min(1), name: z.string().min(1), mobile: z.string().regex(/^\+?\d[\d\s-]{7,14}$/), via: z.enum(["whatsapp", "sms"]) });
export type InviteInput = z.infer<typeof inviteInputSchema>;
export const memberUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  relation: z.string().min(1),
  mobile: z.string().regex(/^$|^\+?\d[\d\s-]{7,14}$/),
  email: z.string().regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  channel: z.enum(["whatsapp", "sms", "email"]),
});
export type MemberUpdate = z.infer<typeof memberUpdateSchema>;
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

// F1b (profile): shapes follow the user-data-store spec (household_places, device_permissions).
export const addressSchema = z.object({
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).default(""),
  landmark: z.string().trim().max(80).default(""),
  city: z.string().trim().min(1).max(60),
  state: z.string().trim().min(1).max(60),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  country: z.string().default("IN"),
});
export type Address = z.infer<typeof addressSchema>;
/** Input shape of the address form (before defaults). */
export type AddressInput = z.input<typeof addressSchema>;

/** +91 and ten digits starting 6 to 9, stored as +91XXXXXXXXXX. */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/))
  .transform((v) => (v.startsWith("+91") ? v : `+91${v}`));

export const permissionName = z.enum(["location", "notifications", "contacts", "calendar", "microphone", "camera"]);
export type PermissionName = z.infer<typeof permissionName>;
export const permissionState = z.enum(["granted", "denied", "dismissed", "revoked"]);
export type PermissionState = z.infer<typeof permissionState>;
export const permissionSurface = z.enum(["onboarding", "emergency", "settings", "family", "other"]);
export type PermissionSurface = z.infer<typeof permissionSurface>;

export const currentLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative(),
  precision: z.enum(["exact", "coarse"]),
});
export type CurrentLocation = z.infer<typeof currentLocationSchema>;

export const placeKind = z.enum(["home", "work"]);
export type PlaceKind = z.infer<typeof placeKind>;
// City, state and pincode are what the backend stores; a saved place is only sent to it when all three are present.
export const placeAddressSchema = z.object({
  line1: z.string().trim().min(1).max(120),
  city: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  pincode: z.string().trim().max(6).optional(),
  country: z.string().default("IN"),
});
export type PlaceAddress = z.input<typeof placeAddressSchema>;
export const savedPlaceSchema = z.object({ id: z.string(), kind: placeKind, label: z.string(), address: placeAddressSchema });
export type SavedPlace = z.infer<typeof savedPlaceSchema>;

export const profileSchema = z.object({
  mobile: z.string().nullable(),
  address: addressSchema.nullable(),
  addressSource: z.enum(["user_typed", "digilocker"]).nullable(),
  permissions: z.partialRecord(permissionName, permissionState),
  currentLocation: currentLocationSchema.nullable(),
  places: z.array(savedPlaceSchema),
});
export type Profile = z.infer<typeof profileSchema>;
