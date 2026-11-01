"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { adapters } from "@/adapters";
import { SectionHeading } from "@/components/type";
import { BrandLogo } from "@/components/logos/BrandLogo";
import { useTheme } from "@/components/theme";
import { useMe } from "@/components/shell";
import ui from "./ui.module.css";
import s from "./Settings.module.css";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
const KEY = "knowvia-settings";

type Prefs = {
  sources: Record<string, boolean>;
  notify: Record<string, boolean>;
  sharing: Record<string, boolean>;
  voice: "en" | "hi" | "both";
  reduced: boolean;
};
const DEFAULTS: Prefs = {
  sources: { gmail: true, digilocker: true, abha: false },
  notify: { whatsapp: true, email: true, calendar: false },
  sharing: { rohan: true, mother: true, father: false },
  voice: "both",
  reduced: false,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* storage unavailable: defaults */
  }
  return DEFAULTS;
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx(s.switch, on && s.switchOn)} onClick={() => onChange(!on)} />
  );
}

/** `logos` are rendered on the server (OfficialLogo reads public/logos) and passed in. */
export function SettingsView({ logos }: { logos: { digilocker: ReactNode; abha: ReactNode } }) {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const { theme, setTheme } = useTheme();
  const { state: me } = useMe();
  const router = useRouter();

  useEffect(() => {
    // Preferences live in this browser only; read them after mount to keep server and client markup equal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setP(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-motion", p.reduced ? "reduced" : "normal");
  }, [p, ready]);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((x) => ({ ...x, [k]: v }));
  const flip = (k: "sources" | "notify" | "sharing", id: string, v: boolean) => setP((x) => ({ ...x, [k]: { ...x[k], [id]: v } }));

  const sources: { id: string; name: string; detail: string; logo: ReactNode }[] = [
    { id: "gmail", name: "Gmail", detail: "Finds premium receipts and insurer emails", logo: <BrandLogo id="gmail" size={40} /> },
    { id: "digilocker", name: "DigiLocker", detail: "Pulls policy documents you already hold", logo: logos.digilocker },
    { id: "abha", name: "ABHA", detail: "Links your health ID to the e-card", logo: logos.abha },
  ];
  const notify = [
    { id: "whatsapp", name: "WhatsApp", detail: "Case updates and renewal reminders", logo: <BrandLogo id="whatsapp" size={40} /> },
    { id: "email", name: "Email", detail: "A weekly note and anything that needs you", logo: <BrandLogo id="gmail" size={40} /> },
    { id: "calendar", name: "Calendar", detail: "Renewal and tax dates on your calendar", logo: <BrandLogo id="google-calendar" size={40} /> },
  ];
  const people = [
    { id: "rohan", name: "Rohan", detail: "Policies, claims and e-cards" },
    { id: "mother", name: "Mother", detail: "Her own policy and claims only" },
    { id: "father", name: "Father", detail: "Not shared yet" },
  ];

  return (
    <div className={s.col}>
      <SectionHeading title="Connected sources" description="Connect only what you want Knowvia to read. Disconnect any time.">
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
                  <button type="button" className={cx(ui.btn, ui.btnSm)} onClick={() => flip("sources", x.id, !on)} aria-label={`${on ? "Disconnect" : "Connect"} ${x.name}`}>
                    {on ? "Disconnect" : "Connect"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </SectionHeading>

      <SectionHeading title="Notifications" description="Where Knowvia tells you things.">
        <div className={s.rows}>
          {notify.map((x) => (
            <div key={x.id} className={s.row}>
              <span className={s.tile}>{x.logo}</span>
              <span>
                <span className={s.name}>{x.name}</span>
                <span className={ui.small}>{x.detail}</span>
              </span>
              <span className={s.hit}>
                <Switch on={p.notify[x.id]} label={x.name} onChange={(v) => { flip("notify", x.id, v); if (v) adapters.notify.send(x.id === "calendar" ? "google-calendar" : (x.id as "whatsapp" | "email"), "Notifications on"); }} />
              </span>
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Sharing" description="Family members who can see your policies.">
        <div className={s.rows}>
          {people.map((x) => (
            <div key={x.id} className={cx(s.row, s.plain)}>
              <span>
                <span className={s.name}>{x.name}</span>
                <span className={ui.small}>{x.detail}</span>
              </span>
              <span className={s.hit}>
                <Switch on={p.sharing[x.id]} label={`Share with ${x.name}`} onChange={(v) => flip("sharing", x.id, v)} />
              </span>
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Voice and display">
        <div className={s.rows}>
          <div className={cx(s.row, s.plain)}>
            <span><span className={s.name}>Voice language</span><span className={ui.small}>What Ask Knowvia listens for</span></span>
            <span className={s.seg} role="group" aria-label="Voice language">
              {([["en", "English"], ["hi", "हिंदी"], ["both", "Both"]] as const).map(([id, l]) => (
                <button key={id} type="button" aria-pressed={p.voice === id} onClick={() => set("voice", id)}>{l}</button>
              ))}
            </span>
          </div>
          <div className={cx(s.row, s.plain)}>
            <span><span className={s.name}>Reduce motion</span><span className={ui.small}>Fades only, nothing slides or moves by itself</span></span>
            <span className={s.hit}><Switch on={p.reduced} label="Reduce motion" onChange={(v) => set("reduced", v)} /></span>
          </div>
          <div className={cx(s.row, s.plain)}>
            <span><span className={s.name}>Theme</span><span className={ui.small}>Light or dark, on every page</span></span>
            <span className={s.seg} role="group" aria-label="Theme">
              {([["light", "Light"], ["dark", "Dark"]] as const).map(([id, l]) => (
                <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)}>{l}</button>
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
            <button type="button" className={cx(ui.btn, ui.btnSm)} onClick={() => adapters.access.signOut().then(() => { router.push("/"); })}>Sign out</button>
          </div>
        </div>
      </SectionHeading>
    </div>
  );
}
