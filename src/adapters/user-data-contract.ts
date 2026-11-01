import { z } from "zod";
import { INDIAN_STATES, roundCoarse } from "@/lib/india";

// Wire contract of /api/app/{permissions,places,preferences,onboarding}. Shared by the BFF routes (input allow-lists) and the
// browser adapters (response parsing). Mirrors the backend user-data contract (ADR 0015): closed enums, size caps, no unknown keys.
// Legal review: permission and location wording is not final.

const revision = z.number().int().min(0).max(1_000_000_000);
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const PERMISSION_NAMES = ["location", "notifications", "contacts", "calendar", "microphone", "camera"] as const;
export const PERMISSION_STATES = ["granted", "denied", "dismissed", "revoked"] as const;
export const PERMISSION_SURFACES = ["onboarding", "emergency", "settings", "family", "other"] as const;

export const permissionPut = z.strictObject({
  permission: z.enum(PERMISSION_NAMES),
  state: z.enum(PERMISSION_STATES),
  surface: z.enum(PERMISSION_SURFACES),
  revision: revision.optional(),
});
export type PermissionPut = z.infer<typeof permissionPut>;

export const wireAddress = z.strictObject({
  line1: z.string().trim().min(1).max(120),
  line2: optionalText(120),
  landmark: optionalText(80),
  city: z.string().trim().min(1).max(60),
  state: z.enum(INDIAN_STATES),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  country: z.literal("IN").default("IN"),
});
export type WireAddress = z.infer<typeof wireAddress>;

const coordinate = (min: number, max: number) => z.number().finite().min(min).max(max);
export const wireLocation = z.strictObject({ lat: coordinate(-90, 90), lng: coordinate(-180, 180), accuracyM: z.number().finite().min(0).max(100_000).optional() });

export const placePut = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("registered_address"), address: wireAddress, source: z.enum(["user_typed", "document", "digilocker"]).optional(), revision: revision.optional() }),
  z.strictObject({ kind: z.literal("saved_place"), slot: z.enum(["home", "work", "other"]), label: optionalText(60), address: wireAddress, revision: revision.optional() }),
  z.strictObject({
    kind: z.literal("current_location"),
    location: wireLocation,
    precision: z.enum(["coarse", "exact"]),
    surface: z.enum(["emergency", "onboarding", "settings", "other"]).optional(),
    revision: revision.optional(),
  }),
]).refine((v) => v.kind !== "current_location" || v.precision !== "exact" || v.surface === "emergency", { message: "exact location is only for the Emergency surface" });
export type PlacePut = z.infer<typeof placePut>;

/** About 1 km: the precision the backend keeps unless the Emergency flow asks for exact. */
export const coarsen = (loc: z.infer<typeof wireLocation>) => ({ lat: roundCoarse(loc.lat), lng: roundCoarse(loc.lng), accuracyM: Math.max(loc.accuracyM ?? 0, 1000) });

export const placeDelete = z.strictObject({
  kind: z.enum(["registered_address", "saved_place", "current_location"]),
  slot: z.enum(["home", "work", "other"]).optional(),
  revision: revision.optional(),
}).refine((v) => (v.kind === "saved_place") === (v.slot !== undefined), { message: "slot applies to saved places only" });
export type PlaceDelete = z.infer<typeof placeDelete>;

const uniq = <T extends string>(values: readonly [T, ...T[]]) => z.array(z.enum(values)).max(values.length).refine((a) => new Set(a).size === a.length);
export const wirePrefs = z.strictObject({
  sources: uniq(["documents", "email", "whatsapp", "digilocker", "manual"]).optional(),
  notifications: z.strictObject({ channels: uniq(["email", "sms", "whatsapp", "push"]).optional(), renewalReminders: z.boolean().optional(), claimUpdates: z.boolean().optional() }).optional(),
  sharing: z.strictObject({ defaultScope: z.enum(["private", "household", "advisor"]).optional(), allowFamilyView: z.boolean().optional() }).optional(),
  voiceLanguage: z.enum(["en-IN", "hi-IN", "ta-IN", "te-IN", "bn-IN", "mr-IN", "gu-IN", "kn-IN", "ml-IN", "pa-IN"]).optional(),
  reducedMotion: z.boolean().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});
export type WirePrefs = z.infer<typeof wirePrefs>;
export const prefsPut = z.strictObject({ prefs: wirePrefs, revision: revision.optional() });

export const wireOnboarding = z.strictObject({
  step: z.number().int().min(0).max(50).optional(),
  way: z.enum(["upload", "connect", "talk", "skip"]).optional(),
  people: z.strictObject({ self: z.boolean().optional(), partner: z.boolean().optional(), children: z.boolean().optional(), parents: z.boolean().optional() }).optional(),
  wallet: z.enum(["none", "apple", "google", "later"]).optional(),
});
export type WireOnboarding = z.infer<typeof wireOnboarding>;
export const onboardingPut = z.strictObject({ state: wireOnboarding, completed: z.boolean().optional(), revision: revision.optional() });

// ---- Responses (allow-listed: unknown backend fields are dropped) ---------------------------------------------------------

export const permissionRow = z.object({
  permission: z.enum(PERMISSION_NAMES), state: z.enum(PERMISSION_STATES), surface: z.string().nullish(), revision,
});
export type PermissionRow = z.infer<typeof permissionRow>;
export const permissionsOut = z.object({ ok: z.literal(true), permissions: z.array(permissionRow) });
export const permissionOut = z.object({ ok: z.literal(true), permission: permissionRow });

export const placeRow = z.object({
  kind: z.enum(["registered_address", "saved_place", "current_location"]),
  slot: z.string().nullish(),
  label: z.string().nullish(),
  precision: z.string().nullish(),
  source: z.string().nullish(),
  expiresAt: z.string().nullish(),
  revision,
  address: z.object(wireAddress.shape).optional(),
  location: z.object({ lat: z.number(), lng: z.number(), accuracyM: z.number().nullish() }).optional(),
});
export type PlaceRow = z.infer<typeof placeRow>;
export const placesOut = z.object({ ok: z.literal(true), places: z.array(placeRow) });
export const placeOut = z.object({ ok: z.literal(true), place: placeRow });
export const doneOut = z.object({ ok: z.literal(true) });

export const prefsOut = z.object({ ok: z.literal(true), prefs: wirePrefs.nullable(), revision });
export const onboardingOut = z.object({ ok: z.literal(true), state: wireOnboarding.nullable(), completed: z.boolean(), revision });
