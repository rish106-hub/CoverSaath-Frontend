"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adapters, features, addressSchema, mobileSchema, type Address, type PermissionState, type Profile, type SavedPlace, type UiPrefs } from "@/adapters";
import { SectionHeading } from "@/components/type";
import { BrandLogo } from "@/components/logos";
import { SaveState, useSave } from "@/components/ui/SaveState";
import { useMe, invalidateMe } from "@/components/shell";
import { INDIAN_STATES, roundCoarse } from "@/lib/india";
import { useSingleFlight } from "@/lib/use-single-flight";
import s from "./Profile.module.css";

// Legal review: location and permission wording on this page is not final.

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
type Form = { line1: string; line2: string; landmark: string; city: string; state: string; pincode: string };
const EMPTY: Form = { line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };
const fromAddress = (a: Address): Form => ({ line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode });

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {children}
      {error ? <span className={s.fieldError} id={`${id}-err`} role="alert">{error}</span> : null}
    </div>
  );
}

function YouSection() {
  const { state: me } = useMe();
  const ready = me.status === "ready";
  const name = ready ? me.me.owner.displayName : "";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return (
    <div className={s.identity}>
      <span className={s.avatar} aria-hidden>{initials}</span>
      <div className={s.identityText}>
        <span className={cx(s.strong, s.wrap)} data-testid="you-name">{ready ? name : "Loading"}</span>
        <span className={cx(s.small, s.wrap)} data-testid="you-email">{ready ? (me.me.owner.email ?? "Email not shared") : ""}</span>
      </div>
    </div>
  );
}

function ContactSection({ profile }: { profile: Profile }) {
  const [mobile, setMobile] = useState(profile.mobile ?? "");
  const [error, setError] = useState("");
  const sv = useSave();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = mobileSchema.safeParse(mobile);
    if (!ok.success) {
      setError("Enter a 10-digit mobile number, with or without +91.");
      return;
    }
    setError("");
    void sv.save(async () => {
      const r = await adapters.profile.saveContact({ mobile: ok.data });
      setMobile(r.mobile);
    });
  };
  return (
    <form className={s.stack} onSubmit={submit} noValidate>
      <Field id="pf-mobile" label="Mobile number" error={error}>
        <input id="pf-mobile" className={s.input} inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => { setMobile(e.target.value); sv.reset(); }} aria-invalid={error ? true : undefined} aria-describedby={error ? "pf-mobile-err" : undefined} />
      </Field>
      <div className={s.row}>
        <button type="submit" className="k-btn k-btn--primary" disabled={sv.busy}>Save mobile number</button>
        <SaveState status={sv.status} onRetry={() => void submit({ preventDefault() {} } as FormEvent)} />
      </div>
    </form>
  );
}

function AddressCard({ a, source }: { a: Address; source: Profile["addressSource"] }) {
  const lines = [a.line1, a.line2, a.landmark].filter(Boolean);
  return (
    <div className={s.addressText}>
      {lines.map((l) => <span key={l} className={cx(s.cardText, s.wrap)}>{l}</span>)}
      <span className={cx(s.cardText, s.wrap)}>{a.city}, {a.state} {a.pincode}</span>
      {source === "digilocker" ? <span className={s.small}>From DigiLocker</span> : null}
    </div>
  );
}

function AddressSection({ profile }: { profile: Profile }) {
  const [address, setAddress] = useState<Address | null>(profile.address);
  const [source, setSource] = useState<Profile["addressSource"]>(profile.addressSource);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(profile.address ? fromAddress(profile.address) : EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [fetchFailed, setFetchFailed] = useState(false);
  const sv = useSave();
  const fetcher = useSave();
  const remover = useSave();

  const set = (k: keyof Form, v: string) => { setForm((f) => ({ ...f, [k]: v })); sv.reset(); };

  const fetchIt = () => {
    setFetchFailed(false);
    void (async () => {
      // Both paths end in the same saveAddress.
      let fetched: Address | null = null;
      const okFetch = await fetcher.save(async () => { fetched = await adapters.profile.fetchAddressFromDigiLocker(); });
      if (!okFetch || !fetched) {
        setFetchFailed(true);
        setEditing(true);
        return;
      }
      const got: Address = fetched;
      await sv.save(async () => {
        const saved = await adapters.profile.saveAddress(got, "digilocker");
        setAddress(saved); setSource("digilocker"); setForm(fromAddress(saved)); setEditing(false);
      });
    })();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof Form, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Form;
        next[k] = k === "pincode" ? "Enter a 6-digit pincode that does not start with 0." : "Required";
      }
      setErrors(next);
      return;
    }
    setErrors({});
    void sv.save(async () => {
      const saved = await adapters.profile.saveAddress(parsed.data, "user_typed");
      setAddress(saved); setSource("user_typed"); setEditing(false); setFetchFailed(false);
    });
  };

  const remove = () =>
    void remover.save(async () => {
      await adapters.profile.deleteAddress();
      setAddress(null); setSource(null); setForm(EMPTY); setEditing(false);
    });

  const showForm = editing;
  return (
    <div className={s.card}>
      <div className={s.stack}>
        {address && !showForm ? (
          <>
            <AddressCard a={address} source={source} />
            <div className={s.row}>
              <button type="button" className="k-btn k-btn--sm" onClick={() => { setForm(fromAddress(address)); setEditing(true); sv.reset(); }}>Edit</button>
              <button type="button" className="k-btn k-btn--sm" onClick={remove} disabled={remover.busy}>Remove</button>
              <SaveState status={remover.status} onRetry={remove} />
            </div>
          </>
        ) : null}
        {!address && !showForm ? (
          <div className={s.row}>
            {features.digilockerFetch ? (
              <button type="button" className="k-btn k-btn--primary" onClick={fetchIt} disabled={fetcher.busy || sv.busy}>
                {fetcher.busy ? "Fetching from DigiLocker" : "Fetch from DigiLocker"}
              </button>
            ) : null}
            <button type="button" className={features.digilockerFetch ? "k-btn k-btn--secondary" : "k-btn k-btn--primary"} onClick={() => setEditing(true)}>{features.digilockerFetch ? "Add it yourself" : "Add your address"}</button>
            <SaveState status={sv.status} />
          </div>
        ) : null}
        {fetchFailed ? <p className={s.notice} role="status">Could not reach DigiLocker. Add the address yourself.</p> : null}
        {showForm ? (
          <form className={s.stack} onSubmit={submit} noValidate aria-label="Registered address">
            <div className={s.grid}>
              <div className={s.full}>
                <Field id="ad-line1" label="Address line 1" error={errors.line1}>
                  <input id="ad-line1" className={s.input} autoComplete="address-line1" value={form.line1} onChange={(e) => set("line1", e.target.value)} />
                </Field>
              </div>
              <div className={s.full}>
                <Field id="ad-line2" label="Address line 2">
                  <input id="ad-line2" className={s.input} autoComplete="address-line2" value={form.line2} onChange={(e) => set("line2", e.target.value)} />
                </Field>
              </div>
              <div className={s.full}>
                <Field id="ad-landmark" label="Landmark">
                  <input id="ad-landmark" className={s.input} value={form.landmark} onChange={(e) => set("landmark", e.target.value)} />
                </Field>
              </div>
              <Field id="ad-city" label="City" error={errors.city}>
                <input id="ad-city" className={s.input} autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field id="ad-state" label="State" error={errors.state}>
                <select id="ad-state" className={s.input} autoComplete="address-level1" value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Choose a state</option>
                  {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </Field>
              <Field id="ad-pincode" label="Pincode" error={errors.pincode}>
                <input id="ad-pincode" className={s.input} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
            <div className={s.row}>
              <button type="submit" className="k-btn k-btn--primary" disabled={sv.busy}>Save address</button>
              <button type="button" className="k-btn k-btn--secondary" onClick={() => { setEditing(false); setErrors({}); setFetchFailed(false); }}>Cancel</button>
              <SaveState status={sv.status} onRetry={() => submit()} />
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

const PERMISSION_LABEL = (st: PermissionState | undefined) => (st === "granted" ? "Allowed" : st ? "Not allowed" : "Not asked");

function LocationSection({ profile }: { profile: Profile }) {
  const [permission, setPermission] = useState<PermissionState | undefined>(profile.permissions.location);
  const [current, setCurrent] = useState(profile.currentLocation);
  const [places, setPlaces] = useState<SavedPlace[]>(profile.places);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"home" | "work" | null>(null);
  const [text, setText] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [placeState, setPlaceState] = useState("");
  const [placePin, setPlacePin] = useState("");
  const [placeError, setPlaceError] = useState("");
  const allow = useSave();
  const clear = useSave();
  const add = useSave();
  const drop = useSave();

  const ask = () => {
    setMessage("");
    const geo = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geo) {
      setMessage("This device cannot share its location.");
      return;
    }
    void allow.save(
      () =>
        new Promise<void>((resolve, reject) => {
          geo.getCurrentPosition(
            (pos) => {
              void (async () => {
                try {
                  await adapters.profile.setPermission("location", "granted", "settings");
                  // Coarse on purpose: about 1 km, kept 24 hours. Exact position is only for the Emergency flow.
                  const saved = await adapters.profile.saveCurrentLocation({
                    lat: roundCoarse(pos.coords.latitude),
                    lng: roundCoarse(pos.coords.longitude),
                    accuracyM: Math.round(pos.coords.accuracy),
                    precision: "coarse",
                  });
                  setPermission("granted"); setCurrent(saved);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              })();
            },
            (err) => {
              // Denied is a decision to record; other failures (no signal, timeout) are not.
              if (err.code === 1) {
                void adapters.profile.setPermission("location", "denied", "settings").catch(() => {});
                setPermission("denied");
                setMessage("Location is not allowed. You can change this in your browser settings.");
                resolve();
              } else {
                setMessage("We could not get your location just now. Try again in a moment.");
                resolve();
              }
            },
            { maximumAge: 60_000, timeout: 10_000 },
          );
        }),
    );
  };

  const turnOff = () =>
    void allow.save(async () => {
      await adapters.profile.setPermission("location", "revoked", "settings");
      setPermission("revoked"); setCurrent(null);
    });

  const clearIt = () =>
    void clear.save(async () => {
      await adapters.profile.clearCurrentLocation();
      setCurrent(null);
    });

  const openPlace = (k: "home" | "work") => {
    const old = places.find((p) => p.kind === k);
    setKind(k); setPlaceError(""); add.reset();
    setText(old?.address.line1 ?? ""); setPlaceCity(old?.address.city ?? ""); setPlaceState(old?.address.state ?? ""); setPlacePin(old?.address.pincode ?? "");
  };
  const addPlace = (e: FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    if (!text.trim() || !placeCity.trim() || !placeState || !/^[1-9]\d{5}$/.test(placePin)) {
      setPlaceError("Enter the address, city, state and a 6-digit pincode.");
      return;
    }
    setPlaceError("");
    void add.save(async () => {
      const p = await adapters.profile.savePlace(kind, kind === "home" ? "Home" : "Work", { line1: text.trim(), city: placeCity.trim(), state: placeState, pincode: placePin, country: "IN" });
      // One place per kind: saving Home again replaces the old Home.
      setPlaces((x) => [...x.filter((q) => q.id !== p.id && q.kind !== p.kind), p]); setKind(null); setText(""); setPlaceCity(""); setPlaceState(""); setPlacePin("");
    });
  };
  const removePlace = (id: string) =>
    void drop.save(async () => {
      await adapters.profile.deletePlace(id);
      setPlaces((x) => x.filter((p) => p.id !== id));
    });

  return (
    <div className={s.stack}>
      <div className={s.card}>
        <div className={s.rowBetween}>
          <span className={s.strong}>Location access</span>
          <span className={cx(s.status, permission === "granted" && s.statusOn)} data-testid="location-state">{PERMISSION_LABEL(permission)}</span>
        </div>
        <div className={s.row}>
          <button type="button" className="k-btn k-btn--primary" onClick={ask} disabled={allow.busy}>Allow location</button>
          {permission === "granted" ? <button type="button" className="k-btn k-btn--sm" onClick={turnOff} disabled={allow.busy}>Turn off</button> : null}
          <SaveState status={allow.status} onRetry={ask} />
        </div>
        {message ? <p className={s.notice} role="status">{message}</p> : null}
        {current ? (
          <div className={s.rowBetween}>
            <span className={cx(s.cardText, s.wrap)}>Current place: about 1 km (kept for 24 hours)</span>
            <span className={s.row}>
              <button type="button" className="k-btn k-btn--sm" onClick={clearIt} disabled={clear.busy}>Clear</button>
              <SaveState status={clear.status} onRetry={clearIt} />
            </span>
          </div>
        ) : null}
      </div>

      <div className={s.placeGrid}>
        {(["home", "work"] as const).map((k) => {
          const p = places.find((q) => q.kind === k);
          const name = k === "home" ? "Home" : "Work";
          return (
            <div key={k} className={cx(s.card, s.placeCard)} data-testid={`place-${k}`}>
              <span className={s.strong}>{name}</span>
              <span className={cx(p ? s.cardText : s.small, s.wrap, s.clamp)}>{p ? [p.address.line1, p.address.city, p.address.pincode].filter(Boolean).join(", ") : "Not set"}</span>
              <span className={s.row}>
                <button type="button" className="k-btn k-btn--sm" onClick={() => openPlace(k)} aria-label={`${p ? "Edit" : "Add"} ${name}`}>{p ? "Edit" : "Add"}</button>
                {p ? <button type="button" className="k-btn k-btn--sm" onClick={() => removePlace(p.id)} disabled={drop.busy} aria-label={`Remove ${name}`}>Remove</button> : null}
              </span>
            </div>
          );
        })}
      </div>
      <SaveState status={drop.status} />

      {kind ? (
        <form className={cx(s.card, s.stack)} onSubmit={addPlace} noValidate aria-label={`Save ${kind === "home" ? "Home" : "Work"}`}>
          <Field id="pl-text" label="Place address" error={placeError}>
            <input id="pl-text" className={s.input} value={text} onChange={(e) => { setText(e.target.value); add.reset(); }} />
          </Field>
          <div className={s.grid}>
            <Field id="pl-city" label="Place city">
              <input id="pl-city" className={s.input} value={placeCity} onChange={(e) => { setPlaceCity(e.target.value); add.reset(); }} />
            </Field>
            <Field id="pl-state" label="Place state">
              <select id="pl-state" className={s.input} value={placeState} onChange={(e) => { setPlaceState(e.target.value); add.reset(); }}>
                <option value="">Choose a state</option>
                {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </Field>
            <Field id="pl-pin" label="Place pincode">
              <input id="pl-pin" className={s.input} inputMode="numeric" maxLength={6} value={placePin} onChange={(e) => { setPlacePin(e.target.value.replace(/\D/g, "")); add.reset(); }} />
            </Field>
          </div>
          <div className={s.row}>
            <button type="submit" className="k-btn k-btn--primary" disabled={add.busy}>Save place</button>
            <button type="button" className="k-btn k-btn--secondary" onClick={() => setKind(null)}>Cancel</button>
            <SaveState status={add.status} />
          </div>
        </form>
      ) : null}
    </div>
  );
}

type Logos = { digilocker: ReactNode; abha: ReactNode; abdm?: ReactNode };
const SOURCE_DEFAULTS: UiPrefs = {
  sources: { gmail: true, digilocker: true, abha: false },
  notify: { whatsapp: true, email: true, calendar: false },
  sharing: { rohan: true, mother: true, father: false },
  voice: "both",
  reduced: false,
  theme: "light",
};
/** Same rule the Settings page uses to record device permissions when a notification or calendar switch changes. */
const permissionsFor = (p: UiPrefs) => ({ notifications: p.notify.whatsapp || p.notify.email, calendar: !!p.notify.calendar });

type Card = { id: string; group: "sources" | "notify" | "link"; name: string; detail: string; logo: ReactNode; href?: string };

function SourcesSection({ logos }: { logos: Logos }) {
  // The same preferences Settings reads and writes, so both pages agree. Buttons wait until they load.
  const [prefs, setPrefs] = useState<UiPrefs>(SOURCE_DEFAULTS);
  const [load, setLoad] = useState<"loading" | "ready" | "failed">("loading");
  const sv = useSave();
  const loadPrefs = useCallback(() => {
    setLoad("loading");
    adapters.preferences.get().then(
      (saved) => { setPrefs(saved ? { ...SOURCE_DEFAULTS, ...saved } : SOURCE_DEFAULTS); setLoad("ready"); },
      () => setLoad("failed"),
    );
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPrefs();
  }, [loadPrefs]);

  const cards: Card[] = [
    { id: "gmail", group: "sources", name: "Gmail", detail: "Finds premium receipts and insurer emails", logo: <BrandLogo id="gmail" size={40} /> },
    { id: "digilocker", group: "sources", name: "DigiLocker", detail: "Pulls policy documents and your address", logo: logos.digilocker },
    { id: "abha", group: "sources", name: "ABDM", detail: "Links your ABHA health ID", logo: logos.abdm ?? logos.abha },
    { id: "whatsapp", group: "notify", name: "WhatsApp", detail: "Case updates and renewals", logo: <BrandLogo id="whatsapp" size={40} /> },
    { id: "calendar", group: "notify", name: "Calendar", detail: "Renewal and tax dates", logo: <BrandLogo id="google-calendar" size={40} /> },
    { id: "wallets", group: "link", name: "Wallets", detail: "Cards and wallet passes", logo: <span className={s.nameTile}>Wallets</span>, href: "/cards" },
  ];
  const isOn = (c: Card) => (c.group === "notify" ? !!prefs.notify[c.id] : !!prefs.sources[c.id]);

  const flip = (c: Card) => {
    if (c.group === "link") return;
    const v = !isOn(c);
    const next: UiPrefs = { ...prefs, [c.group]: { ...prefs[c.group], [c.id]: v } };
    void sv.save(async () => {
      await adapters.preferences.save(next);
      const was = permissionsFor(prefs);
      const want = permissionsFor(next);
      for (const name of ["notifications", "calendar"] as const) {
        if (want[name] !== was[name]) await adapters.profile.setPermission(name, want[name] ? "granted" : "revoked", "settings");
      }
      setPrefs(next);
    });
  };

  return (
    <div className={s.stack}>
      {load === "failed" ? (
        <p className={s.notice} role="alert">Could not load your sources. <button type="button" className="k-btn k-btn--sm" onClick={loadPrefs}>Retry</button></p>
      ) : null}
      <ul className={s.sourceGrid}>
        {cards.map((c) => {
          const on = isOn(c);
          return (
            <li key={c.id} className={s.sourceCard} data-testid={`source-${c.id}`}>
              <div className={s.sourceTop}>
                <span className={s.tile}>{c.logo}</span>
                <span className={cx(s.tag, on && s.tagOn)}>{on ? "Connected" : "Not connected"}</span>
              </div>
              <span className={cx(s.strong, s.wrap)}>{c.name}</span>
              <span className={cx(s.small, s.wrap)}>{c.detail}</span>
              {c.href ? (
                <Link href={c.href} className="k-btn k-btn--sm k-btn--secondary" aria-label={`Manage ${c.name}`}>Manage</Link>
              ) : (
                <button type="button" className={cx("k-btn k-btn--sm", on ? "k-btn--secondary" : "k-btn--primary")} onClick={() => flip(c)} disabled={load !== "ready" || sv.busy} aria-label={`${on ? "Disconnect" : "Connect"} ${c.name}`}>
                  {on ? "Disconnect" : "Connect"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <SaveState status={sv.status} />
    </div>
  );
}

function AccountSection() {
  const router = useRouter();
  const out = useSingleFlight();
  const signOut = () =>
    out.run(async () => {
      try {
        await adapters.access.signOut();
      } catch {
        return;
      }
      invalidateMe();
      if (out.alive()) router.push("/");
    });
  return (
    <div className={s.row}>
      <button type="button" className="k-btn k-btn--danger" onClick={signOut} disabled={out.busy}>Sign out</button>
      <span className={s.small}>This ends your session on this device.</span>
    </div>
  );
}

export const PROFILE_SECTIONS = [
  { id: "you", title: "You" },
  { id: "contact", title: "Contact" },
  { id: "address", title: "Address" },
  { id: "location", title: "Location" },
  { id: "sources", title: "Connected sources" },
  { id: "account", title: "Account" },
] as const;
type SectionId = (typeof PROFILE_SECTIONS)[number]["id"];
/** Sections shown now: Contact is off while the backend has nowhere to store a mobile number (features.profileMobile). */
const SECTIONS = PROFILE_SECTIONS.filter((x) => x.id !== "contact" || features.profileMobile);
const anchor = (id: string) => `profile-${id}`;

function SectionNav({ active, onPick }: { active: SectionId; onPick: (id: SectionId) => void }) {
  const go = (e: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    e.preventDefault();
    onPick(id);
    const el = document.getElementById(anchor(id));
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" });
    try { window.history.replaceState(null, "", `#${anchor(id)}`); } catch { /* ignore */ }
  };
  return (
    <nav className={s.nav} aria-label="Profile sections">
      <ul className={s.navList}>
        {SECTIONS.map((x) => (
          <li key={x.id} className={s.navItem}>
            <a href={`#${anchor(x.id)}`} className={cx(s.navLink, active === x.id && s.navActive)} aria-current={active === x.id ? "location" : undefined} onClick={(e) => go(e, x.id)}>{x.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** `logos` are rendered on the server (OfficialLogo reads public/logos) and passed in. */
export function ProfileView({ logos }: { logos: Logos }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<SectionId>("you");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    adapters.profile.get().then((p) => live && setProfile(p)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  // Scroll-spy: the section nearest the top of the viewport is current. Without IntersectionObserver the nav still works by click.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !root.current) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) seen.set(en.target.id, en.isIntersecting);
        const first = SECTIONS.find((x) => seen.get(anchor(x.id)));
        if (first) setActive(first.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    root.current.querySelectorAll("[data-profile-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const wait = failed ? (
    <p className={s.notice} role="alert">Could not load your details. Refresh to try again.</p>
  ) : (
    <p className={s.small} role="status">Loading your details</p>
  );
  const body: Record<SectionId, ReactNode> = {
    you: <YouSection />,
    contact: profile ? <ContactSection profile={profile} /> : wait,
    address: profile ? <AddressSection profile={profile} /> : wait,
    location: profile ? <LocationSection profile={profile} /> : wait,
    sources: <SourcesSection logos={logos} />,
    account: <AccountSection />,
  };

  return (
    <div className={s.layout} ref={root}>
      <SectionNav active={active} onPick={setActive} />
      <div className={s.col}>
        {SECTIONS.map((x) => (
          <div key={x.id} id={anchor(x.id)} data-profile-section className={s.anchor}>
            <SectionHeading title={x.title}>{body[x.id]}</SectionHeading>
          </div>
        ))}
      </div>
    </div>
  );
}
