"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RETURN_PARAM, returnPathFromSearch } from "@/lib/return-path";
import { useReturnPath } from "@/lib/use-return-path";
import { adapters, AdapterError, googleSignIn, usingBackend } from "@/adapters";
import { BrandLogo } from "@/components/logos";
import { invalidateMe } from "@/components/shell/useMe";
import { validateAccess, type AccessErrors } from "@/components/public/validate";
import styles from "./AccessCard.module.css";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; name: string } | { kind: "error"; message: string };

/** The default demo address; the field also appears whenever the server asks for a password. */
const DEMO_HINT = "demo@demo.com";
const GOOGLE_ERRORS: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_failed: "Google sign-in didn’t complete. Try again.",
  google_unavailable: "Google sign-in isn’t available right now.",
  google_busy: "Too many sign-ins right now. Try again in a minute.",
};
const DOWN = "Can’t reach Knowvia right now. Try again in a moment.";

/** "rishav.dewan@x.com" -> "Rishav Dewan". Waitlist hero signups carry no name; the access schema needs one. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/\+.*$/, "") ?? "";
  const words = local.split(/[._-]+/).map((w) => w.replace(/\d+/g, "")).filter(Boolean).slice(0, 3);
  const out = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return (out || "there").slice(0, 80);
}

/** Beta access card on the landing page. Submit goes through AccessAdapter (the BFF in dev, the mock in tests). */
export function AccessCard() {
  const router = useRouter();
  const returnTo = useReturnPath();
  const dest = returnTo ?? "/welcome";
  // Handlers read the URL when they run: the first-render closure used by the mount effect predates hydration.
  const target = () => returnPathFromSearch(window.location.search);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [errors, setErrors] = useState<AccessErrors>({});
  const [state, setState] = useState<State>({ kind: "idle" });
  const [auto, setAuto] = useState(false); // true while a waitlist link is being signed in automatically
  const flying = useRef(false); // blocks re-entry within the same tick; state alone is too slow
  const alive = useRef(true);
  const nav = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlError = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("error"), () => null);
  const urlMessage = urlError ? GOOGLE_ERRORS[urlError] : undefined;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (nav.current) clearTimeout(nav.current);
    };
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(name, email, false);
  }

  async function submit(name: string, email: string, viaLink: boolean) {
    if (flying.current) return;
    const demo = askPassword || email.trim().toLowerCase() === DEMO_HINT;
    const who = demo && !name.trim() ? "Demo" : name;
    const check = validateAccess(who, email);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    flying.current = true;
    setState({ kind: "busy" });
    try {
      const res = await adapters.access.submit(demo ? { name: who, email, password } : { name: who, email });
      if (!alive.current) return;
      if (!res.ok) {
        flying.current = false;
        setAuto(false);
        if (res.code === "INVALID_CREDENTIALS") setAskPassword(true);
        setState({ kind: "error", message: res.code === "INVALID_CREDENTIALS" ? "That email and password do not match." : res.code === "INVALID_INPUT" ? "Check your name and email, then try again." : DOWN });
        return;
      }
      const first = res.name ?? name.trim().split(" ")[0];
      invalidateMe();
      if (viaLink) {
        router.replace(target() ?? "/welcome");
        return;
      }
      setState({ kind: "done", name: first });
      const back = target();
      if (back) {
        nav.current = setTimeout(() => router.replace(back), 700);
        return;
      }
      nav.current = setTimeout(() => {
        window.location.href = "https://knowviafrontend.vercel.app/";
      }, 700);
    } catch (err) {
      flying.current = false;
      setAuto(false);
      if (!alive.current) return;
      setState({ kind: "error", message: err instanceof AdapterError ? DOWN : "Something went wrong. Try again." });
    }
  }

  useEffect(() => {
    // Waitlist visitors arrive with ?email=&name= from the Knowvia site. Valid email: sign them in straight away, no form.
    // Anything else (shared link, bad email, failure) falls back to the normal form, prefilled.
    const q = new URLSearchParams(window.location.search);
    const pe = q.get("email")?.trim().slice(0, 320);
    const pn = q.get("name")?.trim().slice(0, 80);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of the URL, which only exists in the browser */
    if (pe) setEmail((cur) => cur || pe);
    if (pn) setName((cur) => cur || pn);
    if (pe && !q.get("error") && validateAccess(pn || nameFromEmail(pe), pe).ok) {
      // keep the email out of the address bar and history; the return path is a plain app path, so it stays
      const keep = returnPathFromSearch(window.location.search);
      window.history.replaceState(null, "", keep ? `${window.location.pathname}?${RETURN_PARAM}=${encodeURIComponent(keep)}` : window.location.pathname);
      setAuto(true);
      void submit(pn || nameFromEmail(pe), pe, true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function withGoogle() {
    if (flying.current) return;
    flying.current = true;
    setState({ kind: "busy" });
    try {
      const res = await adapters.auth.signInWithProvider("google");
      if (!alive.current) return;
      if (!res.ok) {
        flying.current = false;
        setState({ kind: "error", message: res.message ?? DOWN });
        return;
      }
      invalidateMe();
      router.push(target() ?? "/welcome");
    } catch {
      flying.current = false;
      if (!alive.current) return;
      setState({ kind: "error", message: DOWN });
    }
  }

  if (state.kind === "done") {
    return (
      <div className={styles.card} role="status">
        <div className={styles.done}>
          <span className={styles.tick} aria-hidden>✓</span>
          <div className={styles.doneT}>You’re in, {state.name}.</div>
          <div className={styles.doneD}>Access is open on this device. First step: add one policy. It takes about a minute.</div>
          <Link href={dest} className={styles.cta}>Open Knowvia</Link>
        </div>
      </div>
    );
  }
  const busy = state.kind === "busy";
  if (auto) {
    return (
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.done}>
          <div className={styles.doneT}>Getting you in…</div>
          <div className={styles.doneD}>Opening your Knowvia beta.</div>
        </div>
      </div>
    );
  }
  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate aria-label="Get access">
      <div className={styles.title}>Get access in 10 seconds</div>
      {usingBackend && googleSignIn ? (
        <>
      <a className={styles.ghost} href={returnTo ? `/api/app/auth/google?next=${encodeURIComponent(returnTo)}` : "/api/app/auth/google"}>
        <BrandLogo id="google" size={24} />Continue with Google
      </a>
      <div className={styles.or} aria-hidden><span />or<span /></div>
        </>
      ) : null}
      {usingBackend ? null : (
        <>
      <button type="button" className={styles.ghost} onClick={withGoogle} disabled={busy}>
        <BrandLogo id="google" size={24} />Continue with Google
      </button>
      <div className={styles.or} aria-hidden><span />or<span /></div>
        </>
      )}
      <label className={styles.field}>
        <span>Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "acc-name-err" : undefined} />
        {errors.name ? <span id="acc-name-err" className={styles.fieldErr}>{errors.name}</span> : null}
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? "acc-mail-err" : undefined} />
        {errors.email ? <span id="acc-mail-err" className={styles.fieldErr}>{errors.email}</span> : null}
      </label>
      {askPassword || email.trim().toLowerCase() === DEMO_HINT ? (
        <label className={styles.field}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
      ) : null}
      <button type="submit" className={styles.btn} disabled={busy}>{busy ? "Getting you in…" : "Get access"}</button>
      {state.kind === "error" ? <p className={styles.err} role="alert">{state.message}</p> : urlMessage ? <p className={styles.err} role="alert">{urlMessage}</p> : null}
      <div className={styles.note}><span>No card needed. Leave any time.</span><a href="#">Privacy</a></div>
    </form>
  );
}
