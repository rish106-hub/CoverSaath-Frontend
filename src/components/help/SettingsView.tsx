"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { adapters, features, type UiPrefs } from "@/adapters";
import { SaveState } from "@/components/ui/SaveState";
import { useAutosave } from "@/lib/use-autosave";
import { SectionHeading } from "@/components/type";
import { BrandLogo } from "@/components/logos";
import { useTheme } from "@/components/theme";
import { useMe, invalidateMe } from "@/components/shell";
import { isLowCapacity } from "@/lib/capability";
import { useSingleFlight } from "@/lib/use-single-flight";
import ui from "./ui.module.css";
import s from "./Settings.module.css";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

type Prefs = UiPrefs;
const DEFAULTS: Prefs = {
  sources: { gmail: true, digilocker: true, abha: false },
  notify: { whatsapp: true, email: true, calendar: false },
  sharing: { rohan: true, mother: true, father: false },
  voice: "both",
  reduced: false,
  theme: "light",
};

/** Notification and calendar switches also record a device permission (surface: settings). */
const permissionsFor = (p: Prefs) => ({ notifications: p.notify.whatsapp || p.notify.email, calendar: !!p.notify.calendar });

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx(s.switch, on && s.switchOn)} onClick={() => onChange(!on)} disabled={disabled} />
  );
}

/** `logos` are rendered on the server (OfficialLogo reads public/logos) and passed in. */
export function SettingsView({ logos }: { logos: { digilocker: ReactNode; abha: ReactNode } }) {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [load, setLoad] = useState<"loading" | "ready" | "failed">("loading");
  const { theme, setTheme } = useTheme();
  const { state: me } = useMe();
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

  // The last notification/calendar permission the server holds, so only a change by the person is recorded.
  const synced = useRef(permissionsFor(DEFAULTS));
  const sv = useAutosave<Prefs>(async (next) => {
    await adapters.preferences.save(next);
    const want = permissionsFor(next);
    for (const name of ["notifications", "calendar"] as const) {
      if (want[name] === synced.current[name]) continue;
      await adapters.profile.setPermission(name, want[name] ? "granted" : "revoked", "settings");
      synced.current = { ...synced.current, [name]: want[name] };
    }
  });

  const loadPrefs = useCallback(() => {
    setLoad("loading");
    adapters.preferences.get().then(
      (saved) => {
        const next = saved ? { ...DEFAULTS, ...saved } : DEFAULTS;
        setP(next);
        synced.current = permissionsFor(next);
        if (saved && saved.theme !== document.documentElement.getAttribute("data-theme")) setTheme(saved.theme, { persist: false });
        setLoad("ready");
      },
      () => setLoad("failed"),
    );
  }, [setTheme]);
  useEffect(() => {
    // Preferences come from the backend after mount; the first paint uses the defaults so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPrefs();
  }, [loadPrefs]);
  useEffect(() => {
    document.documentElement.setAttribute("data-motion", p.reduced || isLowCapacity() ? "reduced" : "normal");
  }, [p.reduced]);

  const change = (next: Prefs) => {
    setP(next);
    sv.push(next);
  };
  // The theme can also change from the header toggle, so it is always read from the live theme, not from the loaded copy.
  const cur: Prefs = { ...p, theme };
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => change({ ...cur, [k]: v });
  const flip = (k: "sources" | "notify" | "sharing", id: string, v: boolean) => change({ ...cur, [k]: { ...cur[k], [id]: v } });
  const locked = load !== "ready";
  const familyOn = Object.values(p.sharing).some(Boolean);

  const sources: { id: string; name: string; detail: string; logo: ReactNode }[] = [
    { id: "gmail", name: "Gmail", detail: "Premium receipts and insurer emails", logo: <BrandLogo id="gmail" size={40} /> },
    { id: "digilocker", name: "DigiLocker", detail: "Your policy documents", logo: logos.digilocker },
    { id: "abha", name: "ABHA", detail: "Health ID on your e-card", logo: logos.abha },
  ];
  const notify = [
    { id: "whatsapp", name: "WhatsApp", detail: "Case updates and renewals", logo: <BrandLogo id="whatsapp" size={40} /> },
    { id: "email", name: "Email", detail: "Weekly note and urgent items", logo: <BrandLogo id="gmail" size={40} /> },
    { id: "calendar", name: "Calendar", detail: "Renewal and tax dates", logo: <BrandLogo id="google-calendar" size={40} /> },
  ];
  const people = [
    { id: "rohan", name: "Rohan", detail: "Policies, claims and e-cards" },
    { id: "mother", name: "Mother", detail: "Her policy and claims only" },
    { id: "father", name: "Father", detail: "Not shared yet" },
  ];

  return (
    <div className={s.col}>
      <div className={ui.row} role="group" aria-label="Settings status">
        {load === "loading" ? <span className={ui.small} role="status">Loading your settings</span> : null}
        {load === "failed" ? (
          <span className={ui.small} role="alert">
            Could not load your settings. <button type="button" className="k-btn k-btn--sm" onClick={loadPrefs}>Retry</button>
          </span>
        ) : null}
        <SaveState status={sv.status} onRetry={sv.retry} />
      </div>
      <SectionHeading title="Connected sources">
        <div className={s.rows}>
          {sources.map((x) => {
            const on = p.sources[x.id];
            return (
              <div key={x.id} className={s.row}>
                <span className={s.tile}>{x.logo}</span>
                <span>
                  <span className={s.name}>{x.name}</span>
                  <span className={ui.small}>{x.detail}</span>
                </span>
                <span className={ui.row}>
                  <span className={cx(s.status, on && s.statusOn)}>{on ? "Connected" : "Not connected"}</span>
                  <button type="button" className={cx("k-btn k-btn--sm", on ? "" : "k-btn--primary")} onClick={() => flip("sources", x.id, !on)} disabled={locked} aria-label={`${on ? "Disconnect" : "Connect"} ${x.name}`}>
                    {on ? "Disconnect" : "Connect"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </SectionHeading>

      <SectionHeading title="Notifications">
        <div className={s.rows}>
          {notify.map((x) => (
            <div key={x.id} className={s.row}>
              <span className={s.tile}>{x.logo}</span>
              <span>
                <span className={s.name}>{x.name}</span>
                <span className={ui.small}>{x.detail}</span>
              </span>
              <span className={s.hit}>
                <Switch on={!!p.notify[x.id]} label={x.name} disabled={locked} onChange={(v) => { flip("notify", x.id, v); if (v) adapters.notify.send(x.id === "calendar" ? "google-calendar" : (x.id as "whatsapp" | "email"), "Notifications on"); }} />
              </span>
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Sharing">
        <div className={s.rows}>
          {features.perPersonSharing ? people.map((x) => (
            <div key={x.id} className={cx(s.row, s.plain)}>
              <span>
                <span className={s.name}>{x.name}</span>
                <span className={ui.small}>{x.detail}</span>
              </span>
              <span className={s.hit}>
                <Switch on={!!p.sharing[x.id]} label={`Share with ${x.name}`} disabled={locked} onChange={(v) => flip("sharing", x.id, v)} />
              </span>
            </div>
          )) : (
            <div className={cx(s.row, s.plain)}>
              <span>
                <span className={s.name}>Family view</span>
                <span className={ui.small}>Rohan and Mother see your policies, claims and e-cards</span>
              </span>
              <span className={s.hit}>
                <Switch on={familyOn} label="Family view" disabled={locked} onChange={(v) => change({ ...cur, sharing: Object.fromEntries(Object.keys(cur.sharing).map((k) => [k, v ? (DEFAULTS.sharing[k] ?? true) : false])) })} />
              </span>
            </div>
          )}
        </div>
      </SectionHeading>

      <SectionHeading title="Voice and display">
        <div className={s.rows}>
          <div className={cx(s.row, s.plain)}>
            <span><span className={s.name}>Voice language</span><span className={ui.small}>Language Ask Knowvia listens for</span></span>
            <span className={s.seg} role="group" aria-label="Voice language">
              {([["en", "English"], ["hi", "हिंदी"], ["both", "Both"]] as const).map(([id, l]) => (
                <button key={id} type="button" aria-pressed={p.voice === id} disabled={locked} onClick={() => set("voice", id)}>{l}</button>
              ))}
            </span>
          </div>
          <div className={cx(s.row, s.plain)}>
            <span><span className={s.name}>Reduce motion</span><span className={ui.small}>Fades only, no movement</span></span>
            <span className={s.hit}><Switch on={p.reduced} label="Reduce motion" disabled={locked} onChange={(v) => set("reduced", v)} /></span>
          </div>
          <div className={cx(s.row, s.plain)}>
            <span><span className={s.name}>Theme</span><span className={ui.small}>Light or dark</span></span>
            <span className={s.seg} role="group" aria-label="Theme">
              {([["light", "Light"], ["dark", "Dark"]] as const).map(([id, l]) => (
                <button key={id} type="button" aria-pressed={theme === id} disabled={locked} onClick={() => { setTheme(id, { persist: false }); change({ ...cur, theme: id }); }}>{l}</button>
              ))}
            </span>
          </div>
        </div>
      </SectionHeading>

      <SectionHeading title="Account">
        <div className={s.rows}>
          <div className={cx(s.row, s.plain)}>
            <span>
              <span className={s.name}>{me.status === "ready" ? me.me.owner.displayName : "Your account"}</span>
              <span className={ui.small}>{me.status === "ready" ? (me.me.owner.email ?? me.me.householdName) : "Signed in"}</span>
            </span>
            <button type="button" className="k-btn k-btn--sm" onClick={signOut} disabled={out.busy}>Sign out</button>
          </div>
        </div>
      </SectionHeading>
    </div>
  );
}
