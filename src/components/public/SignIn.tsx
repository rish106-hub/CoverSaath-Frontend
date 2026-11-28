"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { useEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReturnPath } from "@/lib/use-return-path";
import { adapters, usingBackend } from "@/adapters";
import { AccessCard } from "@/components/access/AccessCard";
import { useSingleFlight } from "@/lib/use-single-flight";
import { invalidateMe } from "@/components/shell/useMe";
import { BrandLogo } from "@/components/logos";
import { OTP_LENGTH, applyOtpInput, digitsOnly, otpComplete } from "./otp";
import styles from "./signin.module.css";

type Step = "start" | "otp" | "mail" | "done";
// The opening promise; five words at most so it stays one glance on a laptop.
const PUNCH_LINE = "Health cover, finally clear.";
const DOWN = "Can’t reach Knowvia right now. Try again in a moment.";

export function SignIn() {
  const [step, setStep] = useState<Step>("start");
  const [via, setVia] = useState<"phone" | "mail">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { run: once, busy, alive } = useSingleFlight();
  const returnTo = useReturnPath();
  const demoRequested = useSyncExternalStore(() => () => {}, () => process.env.NEXT_PUBLIC_ADAPTERS === "mock" && new URLSearchParams(window.location.search).get("demo") === "1", () => false);

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

  return (
    <div className={`kv-app ${styles.page}`}>
      <main className={styles.left}>
        <BrandMark href="/" size={32} />
        <div className={styles.middle}>
        {step === "start" && usingBackend ? (
          // The backend has no login, OTP or social routes yet; name and email access is the only real way in.
          <div className={styles.form}>
            <h1 className={styles.punch}>{PUNCH_LINE}</h1>
            <AccessCard />
            {demoRequested ? <DemoCard returnTo={returnTo} /> : null}
          </div>
        ) : null}

        {step === "start" && !usingBackend ? (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
            <h1 className={styles.punch}>{PUNCH_LINE}</h1>
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
                <input inputMode="numeric" autoComplete="tel-national" aria-label="Mobile number" placeholder="•••••  •••••" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            <p className={styles.sub}>A sign-in link was sent to {email}.</p>
            <button type="button" className={styles.prov} onClick={() => setStep("done")}>I opened the link</button>
            <button type="button" className={styles.prov} onClick={() => setStep("start")}>Use another email</button>
          </div>
        ) : null}

        {step === "done" ? (
          <div className={styles.form} role="status">
            <div className={styles.tickBig} aria-hidden>✓</div>
            <h1 className={styles.h1}>You’re in.</h1>
            <p className={styles.sub}>{returnTo ? "Taking you back." : "Next, add your policy."}</p>
            <Link href={returnTo ?? "/covers/add"} className={styles.cta}>{returnTo ? "Continue" : "Add my policy"}</Link>
          </div>
        ) : null}

        </div>
        <div className={styles.footer}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </main>
      <div className={styles.photo} aria-hidden="true">
        <Image src="/opening/family.jpg" alt="" fill priority sizes="50vw" className={styles.photoImg} />
      </div>
    </div>
  );
}

/** Public synthetic demo. Shown only for /signin?demo=1. The server turns it off with DEMO_LOGIN_ENABLED=false. */
function DemoCard({ returnTo }: { returnTo: string | null }) {
  const { run: once, busy, alive } = useSingleFlight();
  const [error, setError] = useState("");
  const enter = () =>
    once(async () => {
      setError("");
      try {
        const res = await fetch("/api/app/demo", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json", "x-knowvia-app": "1" },
          body: JSON.stringify({ email: "demo@demo.com", password: "demo123" }),
        });
        if (!alive()) return;
        if (!res.ok) return setError(res.status === 404 ? "The demo isn’t available right now." : DOWN);
        invalidateMe();
        window.location.href = returnTo ?? "/home"; // full load: no mock state carried over
      } catch {
        if (alive()) setError(DOWN);
      }
    });
  return (
    <form className={styles.form} style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); void enter(); }} aria-label="Demo">
      <div>
        <h2 className={styles.sub} style={{ margin: 0, color: "var(--ink)", fontWeight: 600 }}>Demo</h2>
        <p className={styles.small} style={{ margin: "4px 0 0" }}>Look around the app.</p>
      </div>
      {error ? <p className={styles.err} role="alert">{error}</p> : null}
      <button type="submit" className={styles.cta} disabled={busy}>Look around</button>
    </form>
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
