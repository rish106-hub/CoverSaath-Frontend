import { AdapterError, type OnboardingAdapter, type PreferencesAdapter, type ProfileAdapter, type UiOnboarding, type UiPrefs } from "./types";
import { addressSchema, mobileSchema, placeAddressSchema, type Address, type CurrentLocation, type Profile, type SavedPlace } from "./schemas";
import {
  doneOut, onboardingOut, permissionOut, permissionsOut, placeOut, placesOut, prefsOut,
  type PlaceRow, type WireOnboarding, type WirePrefs,
} from "./user-data-contract";
import { roundCoarse } from "@/lib/india";
import { mockProfile } from "./mock/profile";

// Browser adapters for the same-origin BFF routes /api/app/{permissions,places,preferences,onboarding}. They hold the last revision the
// server reported and send it back as the precondition, so a stale write is refused (REVISION_CONFLICT) instead of overwriting.
// On a conflict the adapter re-reads the revision and retries once with the person's latest value.
// Legal review: permission and location wording is not final.

type Parser<T> = { safeParse(v: unknown): { success: true; data: T } | { success: false } };

async function call<T>(path: string, schema: Parser<T>, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", "x-knowvia-app": "1", ...init?.headers } });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const b = (body ?? {}) as { code?: unknown; retryable?: unknown };
    throw new AdapterError(typeof b.code === "string" ? b.code : res.status === 401 ? "UNAUTHENTICATED" : "BACKEND_UNREACHABLE", b.retryable === true || res.status >= 500);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return parsed.data;
}

const send = <T>(path: string, method: "PUT" | "DELETE", schema: Parser<T>, body?: unknown) =>
  call(path, schema, { method, body: body === undefined ? undefined : JSON.stringify(body) });

async function retryOnConflict<T>(refresh: () => Promise<unknown>, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof AdapterError) || e.code !== "REVISION_CONFLICT") throw e;
    await refresh().catch(() => undefined);
    return fn();
  }
}

/** Runs async jobs one after another so two quick saves never race on the same revision. */
function queue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const next = tail.then(job, job);
    tail = next.catch(() => undefined);
    return next;
  };
}

// ---- Profile: permissions and places --------------------------------------------------------------------------------------

const rev = new Map<string, number>();
const placeKey = (kind: string, slot?: string | null) => `place:${kind}${slot ? `:${slot}` : ""}`;
const withRev = (key: string) => (rev.has(key) ? { revision: rev.get(key) } : {});
let mobileMemo: string | null = null; // backend gap: the backend has no route to store a mobile number yet; kept for this visit only.

const toAddress = (a: NonNullable<PlaceRow["address"]>): Address => addressSchema.parse({ ...a, line2: a.line2 ?? "", landmark: a.landmark ?? "" });
const toPlace = (r: PlaceRow): SavedPlace | null => {
  if ((r.slot !== "home" && r.slot !== "work") || !r.address) return null;
  const { line1, city, state, pincode, country } = r.address;
  return { id: r.slot, kind: r.slot, label: r.label ?? (r.slot === "home" ? "Home" : "Work"), address: { line1, city, state, pincode, country } };
};
const toLocation = (r: PlaceRow): CurrentLocation | null =>
  r.location ? { lat: r.location.lat, lng: r.location.lng, accuracyM: r.location.accuracyM ?? 0, precision: r.precision === "exact" ? "exact" : "coarse" } : null;

async function loadProfile(): Promise<Profile> {
  const [perms, places] = await Promise.all([call("/api/app/permissions", permissionsOut), call("/api/app/places", placesOut)]);
  for (const k of [...rev.keys()]) if (k.startsWith("perm:") || k.startsWith("place:")) rev.delete(k);
  const permissions: Profile["permissions"] = {};
  for (const p of perms.permissions) {
    permissions[p.permission] = p.state;
    rev.set(`perm:${p.permission}`, p.revision);
  }
  let address: Address | null = null;
  let addressSource: Profile["addressSource"] = null;
  let currentLocation: CurrentLocation | null = null;
  const saved: SavedPlace[] = [];
  // Absent rows are known to be absent (revision 0), so the first write is a create.
  rev.set(placeKey("registered_address"), 0);
  rev.set(placeKey("current_location"), 0);
  for (const slot of ["home", "work", "other"]) rev.set(placeKey("saved_place", slot), 0);
  for (const r of places.places) {
    rev.set(placeKey(r.kind, r.kind === "saved_place" ? r.slot : null), r.revision);
    if (r.kind === "registered_address" && r.address) {
      address = toAddress(r.address);
      addressSource = r.source === "digilocker" ? "digilocker" : "user_typed";
    } else if (r.kind === "current_location") currentLocation = toLocation(r);
    else if (r.kind === "saved_place") {
      const p = toPlace(r);
      if (p) saved.push(p);
    }
  }
  return { mobile: mobileMemo, address, addressSource, permissions, currentLocation, places: saved };
}

const putPlace = (body: object, key: string) =>
  retryOnConflict(loadProfile, async () => {
    const r = await send("/api/app/places", "PUT", placeOut, { ...body, ...withRev(key) });
    rev.set(key, r.place.revision);
    return r.place;
  });

const deletePlace = async (kind: string, slot?: string) => {
  const key = placeKey(kind, slot);
  try {
    await retryOnConflict(loadProfile, () => {
      const q = new URLSearchParams({ kind, ...(slot ? { slot } : {}), ...(rev.has(key) && rev.get(key)! > 0 ? { revision: String(rev.get(key)) } : {}) });
      return send(`/api/app/places?${q}`, "DELETE", doneOut);
    });
  } catch (e) {
    if (!(e instanceof AdapterError) || e.code !== "NOT_FOUND") throw e; // already gone
  }
  rev.set(key, 0);
};

export const backendProfile: ProfileAdapter = {
  get: loadProfile,
  saveContact: async ({ mobile }) => {
    // backend gap: no route stores a mobile number for a signed-in person yet (it exists only on sign-up).
    const parsed = mobileSchema.safeParse(mobile);
    if (!parsed.success) throw new AdapterError("INVALID_MOBILE");
    mobileMemo = parsed.data;
    return { mobile: parsed.data };
  },
  saveAddress: async (address, source = "user_typed") => {
    const parsed = addressSchema.safeParse(address);
    if (!parsed.success) throw new AdapterError("INVALID_ADDRESS");
    const key = placeKey("registered_address");
    const row = await putPlace({ kind: "registered_address", address: parsed.data, source }, key);
    return row.address ? toAddress(row.address) : parsed.data;
  },
  deleteAddress: () => deletePlace("registered_address"),
  // backend gap: no DigiLocker integration in the backend yet; the fetch stays a mock and its result is saved through saveAddress.
  fetchAddressFromDigiLocker: () => mockProfile.fetchAddressFromDigiLocker(),
  setPermission: async (permission, state, surface) => {
    const key = `perm:${permission}`;
    await retryOnConflict(loadProfile, async () => {
      const r = await send("/api/app/permissions", "PUT", permissionOut, { permission, state, surface, ...withRev(key) });
      rev.set(key, r.permission.revision);
    });
    // The backend erases the current location in the same transaction when location is withdrawn.
    if (permission === "location" && (state === "denied" || state === "revoked")) rev.set(placeKey("current_location"), 0);
  },
  saveCurrentLocation: async (input) => {
    // Round here too (the BFF rounds again): the exact position leaves the browser only for the Emergency surface.
    const exact = input.precision === "exact";
    const location = { lat: exact ? input.lat : roundCoarse(input.lat), lng: exact ? input.lng : roundCoarse(input.lng), accuracyM: input.accuracyM };
    const row = await putPlace({ kind: "current_location", location, precision: input.precision, ...(exact ? { surface: "emergency" } : {}) }, placeKey("current_location"));
    return toLocation(row) ?? { ...location, precision: input.precision };
  },
  clearCurrentLocation: () => deletePlace("current_location"),
  savePlace: async (kind, label, address) => {
    const parsed = placeAddressSchema.safeParse(address);
    const a = parsed.success ? parsed.data : null;
    if (!a || !a.city || !a.state || !a.pincode) throw new AdapterError("INVALID_ADDRESS");
    const row = await putPlace({ kind: "saved_place", slot: kind, label: label.trim() || undefined, address: { line1: a.line1, city: a.city, state: a.state, pincode: a.pincode, country: "IN" } }, placeKey("saved_place", kind));
    const place = toPlace(row);
    if (!place) throw new AdapterError("BACKEND_BAD_RESPONSE");
    return place;
  },
  deletePlace: (id) => deletePlace("saved_place", id),
};

// ---- Settings -------------------------------------------------------------------------------------------------------------

export const DEFAULT_PREFS: UiPrefs = {
  sources: { gmail: true, digilocker: true, abha: false },
  notify: { whatsapp: true, email: true, calendar: false },
  sharing: { rohan: true, mother: true, father: false },
  voice: "both",
  reduced: false,
  theme: "light",
};

// The backend preference enums are closed, so some page switches share a backend value (listed in docs/persistence-matrix.md).
const SOURCE_OUT = { gmail: "email", digilocker: "digilocker", abha: "documents" } as const;
const CHANNEL_OUT = { whatsapp: "whatsapp", email: "email", calendar: "push" } as const;

export function prefsToWire(p: UiPrefs): WirePrefs {
  const pick = <T extends string>(on: Record<string, boolean>, map: Record<string, T>) => Object.keys(map).filter((k) => on[k]).map((k) => map[k]!);
  const anyShared = Object.values(p.sharing).some(Boolean);
  const wire: WirePrefs = {
    sources: pick(p.sources, SOURCE_OUT),
    notifications: { channels: pick(p.notify, CHANNEL_OUT) },
    sharing: { defaultScope: anyShared ? "household" : "private", allowFamilyView: anyShared },
    reducedMotion: p.reduced,
    theme: p.theme,
  };
  if (p.voice !== "both") wire.voiceLanguage = p.voice === "hi" ? "hi-IN" : "en-IN"; // both = no single language chosen
  return wire;
}

export function prefsFromWire(w: WirePrefs, base: UiPrefs = DEFAULT_PREFS): UiPrefs {
  const has = <T extends string>(list: readonly T[] | undefined, v: T) => (list ?? []).includes(v);
  return {
    sources: w.sources ? Object.fromEntries(Object.entries(SOURCE_OUT).map(([k, v]) => [k, has(w.sources, v)])) : base.sources,
    notify: w.notifications?.channels ? Object.fromEntries(Object.entries(CHANNEL_OUT).map(([k, v]) => [k, has(w.notifications!.channels, v)])) : base.notify,
    // backend gap: the contract holds one family-view switch, not one per person. On: the default people; off: nobody.
    sharing: w.sharing ? Object.fromEntries(Object.keys(base.sharing).map((k) => [k, w.sharing!.allowFamilyView ? (DEFAULT_PREFS.sharing[k] ?? true) : false])) : base.sharing,
    voice: w.voiceLanguage === undefined ? "both" : w.voiceLanguage === "hi-IN" ? "hi" : "en",
    reduced: w.reducedMotion ?? base.reduced,
    theme: w.theme === "dark" ? "dark" : w.theme === "light" ? "light" : base.theme,
  };
}

let prefsRevision: number | undefined;
let prefsCache: UiPrefs | null | undefined; // undefined = not read yet
const prefsQueue = queue();

async function readPrefs(): Promise<UiPrefs | null> {
  const r = await call("/api/app/preferences", prefsOut);
  prefsRevision = r.revision;
  prefsCache = r.prefs ? prefsFromWire(r.prefs) : null;
  return prefsCache;
}

async function writePrefs(next: UiPrefs): Promise<UiPrefs> {
  await retryOnConflict(readPrefs, async () => {
    const r = await send("/api/app/preferences", "PUT", prefsOut, { prefs: prefsToWire(next), ...(prefsRevision === undefined ? {} : { revision: prefsRevision }) });
    prefsRevision = r.revision;
  });
  prefsCache = next;
  return next;
}

export const backendPreferences: PreferencesAdapter = {
  get: readPrefs,
  save: (prefs) => prefsQueue(() => writePrefs(prefs)),
  update: (patch) =>
    prefsQueue(async () => {
      if (prefsCache === undefined) await readPrefs();
      return writePrefs({ ...(prefsCache ?? DEFAULT_PREFS), ...patch });
    }),
};

// ---- Onboarding -----------------------------------------------------------------------------------------------------------

const WAY_OUT = { dl: "connect", up: "upload", hr: "talk", no: "skip" } as const;
const WAY_IN = { connect: "dl", upload: "up", talk: "hr", skip: "no" } as const;
const PERSON_OUT = { M: "self", R: "partner", K: "children", A: "parents" } as const;

export function onboardingToWire(o: UiOnboarding): WireOnboarding {
  const w: WireOnboarding = {};
  if (o.step !== undefined) w.step = o.step;
  if (o.way) w.way = WAY_OUT[o.way];
  if (o.people) w.people = Object.fromEntries(Object.entries(PERSON_OUT).filter(([k]) => o.people![k] !== undefined).map(([k, v]) => [v, o.people![k]!]));
  if (o.wallet) w.wallet = o.wallet;
  return w;
}

export function onboardingFromWire(w: WireOnboarding, completed: boolean): UiOnboarding {
  const out: UiOnboarding = { completed };
  if (w.step !== undefined) out.step = w.step;
  if (w.way) out.way = WAY_IN[w.way];
  if (w.people) out.people = Object.fromEntries(Object.entries(PERSON_OUT).filter(([, v]) => w.people![v] !== undefined).map(([k, v]) => [k, w.people![v]!]));
  if (w.wallet) out.wallet = w.wallet;
  return out;
}

let onboardingRevision: number | undefined;
const onboardingQueue = queue();

async function readOnboarding(): Promise<UiOnboarding | null> {
  const r = await call("/api/app/onboarding", onboardingOut);
  onboardingRevision = r.revision;
  return r.state ? onboardingFromWire(r.state, r.completed) : null;
}

export const backendOnboarding: OnboardingAdapter = {
  get: readOnboarding,
  save: (next) =>
    onboardingQueue(async () => {
      await retryOnConflict(readOnboarding, async () => {
        const r = await send("/api/app/onboarding", "PUT", onboardingOut, { state: onboardingToWire(next), completed: next.completed, ...(onboardingRevision === undefined ? {} : { revision: onboardingRevision }) });
        onboardingRevision = r.revision;
      });
      return next;
    }),
};

/** Test helper: forget cached revisions. */
export function resetUserDataCache() {
  rev.clear();
  mobileMemo = null;
  prefsRevision = undefined;
  prefsCache = undefined;
  onboardingRevision = undefined;
}
