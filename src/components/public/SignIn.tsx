"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { adapters } from "@/adapters";
import { useTicker } from "@/lib/use-ticker";
import { useSingleFlight } from "@/lib/use-single-flight";
import { invalidateMe } from "@/components/shell/useMe";
import { BrandLogo } from "@/components/logos";
import { ThemeToggle } from "@/components/theme";
import { AUTH_CARDS, AUTH_FILTERS, AUTH_HEADS, AUTH_WHYS, type AuthCard } from "@/data/mock";
import { OTP_LENGTH, applyOtpInput, digitsOnly, otpComplete } from "./otp";
import tones from "./tones.module.css";
import styles from "./signin.module.css";

type Step = "start" | "otp" | "mail" | "done";
const JOURNEY = ["Sign in", "Add policy", "Reading", "Home"];
const DOWN = "Can’t reach Knowvia right now. Try again in a moment.";

export function SignIn() {
  const [step, setStep] = useState<Step>("start");
  const [via, setVia] = useState<"phone" | "mail">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { run: once, busy, alive } = useSingleFlight();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, next: Step) {
    return once(async () => {
      setError("");
      try {
        const r = await fn();
        if (!alive()) return;
        if (r.ok) {
          if (next === "done") invalidateMe();
          setStep(next);
        } else setError(r.message ?? DOWN);
      } catch {
        if (alive()) setError(DOWN);
      }
    });
  }

  function send() {
    if (via === "phone") {
      if (digitsOnly(phone).length !== 10) return setError("Enter your 10-digit mobile number.");
      return run(() => adapters.auth.sendOtp(`+91${digitsOnly(phone)}`), "otp");
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter an email like name@company.com.");
    return run(() => adapters.auth.sendEmailLink(email.trim()), "mail");
  }

  const at = step === "done" ? 1 : 0;
  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <BrandMark href="/" size={32} />
        <ol className={styles.journey} style={{ listStyle: "none", padding: 0, marginBottom: 0 }} aria-label="Your first minutes">
          {JOURNEY.map((t, k) => (
            <li key={t} className={styles.jstep}>
              <span className={styles.jbar} style={{ background: k < at ? "var(--harbour)" : k === at ? "var(--sea-glass)" : "var(--line)" }} />
              <span className={styles.jlab}>
                <span className={styles.jn} style={{ background: k <= at ? "var(--harbour)" : "var(--line)", color: k <= at ? "var(--on-harbour)" : "var(--graphite)" }}>{k < at ? "✓" : k + 1}</span>
                {t}
              </span>
            </li>
          ))}
        </ol>

        {step === "start" ? (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
            <div>
              <h1 className={styles.h1}>Welcome to Knowvia</h1>
              <p className={styles.sub}>Sign in or create an account. Same button.</p>
            </div>
            <button type="button" className={styles.prov} disabled={busy} onClick={() => run(() => adapters.auth.signInWithProvider("google"), "done")}><BrandLogo id="google" size={24} />Continue with Google</button>
            <button type="button" className={styles.prov} disabled={busy} onClick={() => run(() => adapters.auth.signInWithProvider("apple"), "done")}><BrandLogo id="apple" size={24} />Continue with Apple</button>
            <div className={styles.or} aria-hidden><span />or<span /></div>
            <div className={styles.seg} role="tablist" aria-label="Sign in with">
              <button type="button" role="tab" aria-selected={via === "phone"} className={`${styles.tab} ${via === "phone" ? styles.tabOn : ""}`} onClick={() => { setVia("phone"); setError(""); }}>Phone</button>
              <button type="button" role="tab" aria-selected={via === "mail"} className={`${styles.tab} ${via === "mail" ? styles.tabOn : ""}`} onClick={() => { setVia("mail"); setError(""); }}>Email</button>
            </div>
            {via === "phone" ? (
              <label className={styles.field}>
                <span className={styles.cc}>+91</span>
                <input inputMode="numeric" autoComplete="tel-national" aria-label="Mobile number" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            ) : (
              <label className={styles.field}>
                <input type="email" autoComplete="email" aria-label="Email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            )}
            {error ? <p className={styles.err} role="alert">{error}</p> : null}
            <button type="submit" className={styles.cta} disabled={busy}>{via === "phone" ? "Send code" : "Email me a link"}</button>
          </form>
        ) : null}

        {step === "otp" ? (
          <div className={styles.form}>
            <div>
              <h1 className={styles.h1}>Enter the code</h1>
              <p className={styles.sub}>Sent to +91 {phone}. <button type="button" className={styles.link} onClick={() => setStep("start")}>Change</button></p>
            </div>
            <OtpBoxes busy={busy} error={error} onComplete={(code) => run(() => adapters.auth.verifyOtp(`+91${digitsOnly(phone)}`, code), "done")} />
            <div className={styles.small}>Didn’t get it? <button type="button" className={styles.link} onClick={() => run(() => adapters.auth.sendOtp(`+91${digitsOnly(phone)}`), "otp")}>Send again</button></div>
          </div>
        ) : null}

        {step === "mail" ? (
          <div className={styles.form}>
            <h1 className={styles.h1}>Check your inbox</h1>
            <p className={styles.sub}>A sign-in link is on its way to {email}. It opens Knowvia on this device.</p>
            <button type="button" className={styles.prov} onClick={() => setStep("done")}>I clicked the link</button>
            <button type="button" className={styles.prov} onClick={() => setStep("start")}>Use another email</button>
          </div>
        ) : null}

        {step === "done" ? (
          <div className={styles.form} role="status">
            <div className={styles.tickBig} aria-hidden>✓</div>
            <h1 className={styles.h1}>You’re in.</h1>
            <p className={styles.sub}>Next: add your policy. It takes about a minute.</p>
            <Link href="/welcome/add" className={styles.cta}>Add my policy</Link>
          </div>
        ) : null}

        <div className={styles.whys}>
          {AUTH_WHYS.map((w) => (
            <div key={w.t} className={styles.why}><span className={styles.whyI} aria-hidden>{w.i}</span><span className={styles.whyT}>{w.t}</span><span className={styles.whyD}>{w.d}</span></div>
          ))}
        </div>
        <div className={styles.terms}>By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</div>
      </div>
      <ShowcasePanel />
      <div className={styles.themeSlot}><ThemeToggle /></div>
    </div>
  );
}

function OtpBoxes({ busy, error, onComplete }: { busy: boolean; error: string; onComplete: (code: string) => void }) {
  const [boxes, setBoxes] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);

  function put(at: number, text: string) {
    const r = applyOtpInput(boxes, at, text);
    setBoxes(r.boxes);
    refs.current[r.focus]?.focus();
    if (otpComplete(r.boxes)) onComplete(r.boxes.join(""));
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Backspace" && !boxes[i] && i > 0) {
      const next = boxes.slice();
      next[i - 1] = "";
      setBoxes(next);
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  }
  function onPaste(e: ClipboardEvent<HTMLInputElement>, i: number) {
    e.preventDefault();
    put(i, e.clipboardData.getData("text"));
  }
  return (
    <>
      <div className={styles.otp} role="group" aria-label="One-time code">
        {boxes.map((b, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className={styles.box}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            value={b}
            disabled={busy}
            onChange={(e) => (e.target.value === "" ? setBoxes(boxes.map((x, k) => (k === i ? "" : x))) : put(i, e.target.value))}
            onKeyDown={(e) => onKey(e, i)}
            onPaste={(e) => onPaste(e, i)}
          />
        ))}
      </div>
      {error ? <p className={styles.err} role="alert">{error}</p> : null}
      <button type="button" className={styles.cta} disabled={busy || !otpComplete(boxes)} onClick={() => onComplete(boxes.join(""))}>Verify</button>
    </>
  );
}

function ShowcasePanel() {
  const [h, setH] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [pick, setPick] = useState<AuthCard | null>(null);

  const reduce = useReducedMotion();
  useTicker(() => setH((x) => (x + 1) % AUTH_HEADS.length), 3200, !reduce);

  const pool = filter === "all" ? AUTH_CARDS : AUTH_CARDS.filter((c) => c.tag === filter).concat(AUTH_CARDS.filter((c) => c.tag !== filter)).slice(0, 9);
  const lane = (off: number) => { const a = pool.filter((_, k) => k % 3 === off); return a.concat(a); };
  const [a, b] = AUTH_HEADS[h]!;
  return (
    <div className={styles.right}>
      <div className={styles.rtop}>
        <span className={styles.rlab}>What you’ll see in a minute</span>
        <div className={styles.heads}>
          {AUTH_HEADS.map((x, k) => (
            <button key={x[0]} type="button" aria-label={x[0]} onClick={() => setH(k)} style={{ width: k === h ? 28 : 8, background: k === h ? "#f4dc8a" : "rgba(247,245,240,.35)" }} />
          ))}
        </div>
      </div>
      <div className={styles.headline} key={h}>{a}<em>{b}</em></div>
      <div className={styles.filters}>
        {AUTH_FILTERS.map(([id, label]) => (
          <button key={id} type="button" className={`${styles.filter} ${filter === id ? styles.filterOn : ""}`} onClick={() => { setFilter(id); setPick(null); }} aria-pressed={filter === id}>{label}</button>
        ))}
      </div>
      <div className={styles.lanes}>
        {[0, 1, 2].map((off) => (
          <div key={`${filter}-${off}`} className={`${styles.lane} ${off === 1 ? styles.down : styles.up}`}>
            {lane(off).map((c, k) => (
              <button key={`${c.k}-${k}`} type="button" className={`${styles.ic} ${tones[c.tone]} ${pick?.k === c.k ? styles.icOn : ""}`} onClick={() => setPick(c)} aria-hidden={k >= lane(off).length / 2 ? true : undefined} tabIndex={k >= lane(off).length / 2 ? -1 : undefined}>
                <span className={styles.icK}>{c.k}</span>
                <span className={styles.icV}>{c.v}</span>
                <span className={styles.icD}>{c.d}</span>
                <span className={styles.icBar}><i style={{ width: `${c.bar}%` }} /></span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {pick ? (
        <div className={styles.pick} role="status">
          <div style={{ flex: 1 }}><div className={styles.pickK}>{pick.k} · {pick.ref}</div><div className={styles.pickM}>{pick.more}</div></div>
          <button type="button" className={styles.pickX} onClick={() => setPick(null)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}
