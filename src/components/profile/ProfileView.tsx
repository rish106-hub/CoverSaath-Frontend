"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { adapters, addressSchema, mobileSchema, type Address, type PermissionState, type Profile, type SavedPlace } from "@/adapters";
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
const SETTINGS_KEY = "knowvia-settings";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {children}
      {error ? <span className={s.fieldError} id={`${id}-err`} role="alert">{error}</span> : null}
    </div>
  );
}

function YouSection({ profile }: { profile: Profile }) {
  const { state: me } = useMe();
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
    }); // backend gap: wired in P2a
  };
  const ready = me.status === "ready";
  return (
    <SectionHeading title="You" description="How Knowvia knows and reaches you.">
      <form className={s.stack} onSubmit={submit} noValidate>
        <div className={s.row}>
          <div className={s.field}>
            <span className={s.label}>Name</span>
            <span className={s.cardText}>{ready ? me.me.owner.displayName : "…"}</span>
          </div>
          <div className={s.field}>
            <span className={s.label}>Email</span>
            <span className={s.cardText}>{ready ? (me.me.owner.email ?? "Not shared") : "…"}</span>
          </div>
        </div>
        <Field id="pf-mobile" label="Mobile number" error={error}>
          <input id="pf-mobile" className={s.input} inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => { setMobile(e.target.value); sv.reset(); }} aria-invalid={error ? true : undefined} aria-describedby={error ? "pf-mobile-err" : undefined} />
        </Field>
        <div className={s.row}>
          <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={sv.busy}>Save mobile number</button>
          <SaveState status={sv.status} onRetry={() => void submit({ preventDefault() {} } as FormEvent)} />
        </div>
      </form>
    </SectionHeading>
  );
}

function AddressCard({ a, source }: { a: Address; source: Profile["addressSource"] }) {
  const lines = [a.line1, a.line2, a.landmark].filter(Boolean);
  return (
    <div className={s.card}>
      {lines.map((l) => <span key={l} className={s.cardText}>{l}</span>)}
      <span className={s.cardText}>{a.city}, {a.state} {a.pincode}</span>
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
    }); // backend gap: wired in P2a
  };

  const remove = () =>
    void remover.save(async () => {
      await adapters.profile.deleteAddress();
      setAddress(null); setSource(null); setForm(EMPTY); setEditing(false);
    });

  const showForm = editing;
  return (
    <SectionHeading title="Registered address (optional)" description="Helps Knowvia find the right hospital and insurer office near you.">
      <div className={s.stack}>
        {address && !showForm ? (
          <>
            <AddressCard a={address} source={source} />
            <div className={s.row}>
              <button type="button" className={s.btn} onClick={() => { setForm(fromAddress(address)); setEditing(true); sv.reset(); }}>Edit</button>
              <button type="button" className={s.btn} onClick={remove} disabled={remover.busy}>Remove</button>
              <SaveState status={remover.status} onRetry={remove} />
            </div>
          </>
        ) : null}
        {!address && !showForm ? (
          <div className={s.row}>
            <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={fetchIt} disabled={fetcher.busy || sv.busy}>
              {fetcher.busy ? "Fetching from DigiLocker" : "Fetch from DigiLocker"}
            </button>
            <button type="button" className={s.btn} onClick={() => setEditing(true)}>Add it yourself</button>
            <SaveState status={sv.status} />
          </div>
        ) : null}
        {fetchFailed ? <p className={s.notice} role="status">We could not reach DigiLocker just now. You can add the address yourself below.</p> : null}
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
              <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={sv.busy}>Save address</button>
              <button type="button" className={s.btn} onClick={() => { setEditing(false); setErrors({}); setFetchFailed(false); }}>Cancel</button>
              <SaveState status={sv.status} onRetry={() => submit()} />
            </div>
          </form>
        ) : null}
      </div>
    </SectionHeading>
  );
}

const PERMISSION_LABEL = (st: PermissionState | undefined) => (st === "granted" ? "Allowed" : st ? "Not allowed" : "Not asked");

function LocationSection({ profile }: { profile: Profile }) {
  const [permission, setPermission] = useState<PermissionState | undefined>(profile.permissions.location);
  const [current, setCurrent] = useState(profile.currentLocation);
  const [places, setPlaces] = useState<SavedPlace[]>(profile.places);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"home" | "work">("home");
  const [text, setText] = useState("");
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

  const addPlace = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setPlaceError("Enter the address."); return; }
    setPlaceError("");
    void add.save(async () => {
      const p = await adapters.profile.savePlace(kind, kind === "home" ? "Home" : "Work", { line1: text.trim(), country: "IN" });
      setPlaces((x) => [...x, p]); setText("");
    });
  };
  const removePlace = (id: string) =>
    void drop.save(async () => {
      await adapters.profile.deletePlace(id);
      setPlaces((x) => x.filter((p) => p.id !== id));
    });

  return (
    <SectionHeading title="Location" description="Used to find hospitals and blood banks near you. Exact position is only used in an emergency.">
      <div className={s.stack}>
        <div className={s.row}>
          <span className={s.strong}>Location access</span>
          <span className={s.status} data-testid="location-state">{PERMISSION_LABEL(permission)}</span>
        </div>
        <div className={s.row}>
          <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={ask} disabled={allow.busy}>Allow location</button>
          {permission === "granted" ? <button type="button" className={s.btn} onClick={turnOff} disabled={allow.busy}>Turn off</button> : null}
          <SaveState status={allow.status} onRetry={ask} />
        </div>
        {message ? <p className={s.notice} role="status">{message}</p> : null}
        {current ? (
          <div className={s.row}>
            <span className={s.cardText}>Current place: about 1 km (kept for 24 hours)</span>
            <button type="button" className={s.btn} onClick={clearIt} disabled={clear.busy}>Clear</button>
            <SaveState status={clear.status} onRetry={clearIt} />
          </div>
        ) : null}

        <span className={s.strong}>Saved places</span>
        {places.length ? (
          <div className={s.list}>
            {places.map((p) => (
              <div key={p.id} className={s.item}>
                <span>
                  <span className={s.strong}>{p.label}</span>
                  <span className={s.cardText} style={{ display: "block" }}>{p.address.line1}</span>
                </span>
                <button type="button" className={s.btn} onClick={() => removePlace(p.id)} disabled={drop.busy} aria-label={`Remove ${p.label}`}>Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <span className={s.small}>No saved places yet.</span>
        )}
        <form className={s.stack} onSubmit={addPlace} noValidate aria-label="Add a saved place">
          <div className={s.row}>
            <Field id="pl-kind" label="Place">
              <select id="pl-kind" className={s.input} value={kind} onChange={(e) => setKind(e.target.value as "home" | "work")}>
                <option value="home">Home</option>
                <option value="work">Work</option>
              </select>
            </Field>
            <Field id="pl-text" label="Address" error={placeError}>
              <input id="pl-text" className={s.input} value={text} onChange={(e) => { setText(e.target.value); add.reset(); }} />
            </Field>
          </div>
          <div className={s.row}>
            <button type="submit" className={s.btn} disabled={add.busy}>Add place</button>
            <SaveState status={add.status} />
          </div>
        </form>
      </div>
    </SectionHeading>
  );
}

function SourcesSection({ logos }: { logos: { digilocker: ReactNode; abha: ReactNode } }) {
  // Read-only view of what Settings holds (same browser key; defaults match Settings).
  const [on, setOn] = useState<Record<string, boolean>>({ gmail: true, digilocker: true, abha: false });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const saved = raw ? (JSON.parse(raw) as { sources?: Record<string, boolean> }).sources : undefined;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setOn((x) => ({ ...x, ...saved }));
    } catch {
      /* storage unavailable: defaults */
    }
  }, []);
  const rows = [
    { id: "gmail", name: "Gmail", detail: "Finds premium receipts and insurer emails", logo: <BrandLogo id="gmail" size={40} /> },
    { id: "digilocker", name: "DigiLocker", detail: "Pulls policy documents and your address", logo: logos.digilocker },
    { id: "abha", name: "ABHA", detail: "Links your health ID to the e-card", logo: logos.abha },
  ];
  return (
    <SectionHeading title="Connected sources" description="What Knowvia can read for you. Change these in Settings.">
      <div className={s.list}>
        {rows.map((x) => (
          <div key={x.id} className={s.source}>
            <span className={s.tile}>{x.logo}</span>
            <span>
              <span className={s.strong} style={{ display: "block" }}>{x.name}</span>
              <span className={s.small}>{x.detail}</span>
            </span>
            <span className={cx(s.status, on[x.id] && s.statusOn)}>{on[x.id] ? "Connected" : "Not connected"}</span>
          </div>
        ))}
      </div>
    </SectionHeading>
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
    <SectionHeading title="Your account">
      <div className={s.row}>
        <button type="button" className={s.btn} onClick={signOut} disabled={out.busy}>Sign out</button>
      </div>
    </SectionHeading>
  );
}

/** `logos` are rendered on the server (OfficialLogo reads public/logos) and passed in. */
export function ProfileView({ logos }: { logos: { digilocker: ReactNode; abha: ReactNode } }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    adapters.profile.get().then((p) => live && setProfile(p)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  return (
    <div className={s.col}>
      {profile ? (
        <>
          <YouSection profile={profile} />
          <AddressSection profile={profile} />
          <LocationSection profile={profile} />
        </>
      ) : failed ? (
        <p className={s.notice} role="alert">We could not load your details. Refresh to try again.</p>
      ) : (
        <p className={s.small} role="status">Loading your details</p>
      )}
      <SourcesSection logos={logos} />
      <AccountSection />
    </div>
  );
}
