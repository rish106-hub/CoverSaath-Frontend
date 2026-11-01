"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adapters, AdapterError } from "@/adapters";
import { BrandLogo } from "@/components/logos";
import { validateAccess, type AccessErrors } from "@/components/public/validate";
import styles from "./AccessCard.module.css";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; name: string } | { kind: "error"; message: string };

const DOWN = "Can’t reach Knowvia right now. Try again in a moment.";

/** Beta access card on the landing page. Submit goes through AccessAdapter (the BFF in dev, the mock in tests). */
export function AccessCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<AccessErrors>({});
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const check = validateAccess(name, email);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    setState({ kind: "busy" });
    try {
      const res = await adapters.access.submit({ name, email });
      if (!res.ok) {
        setState({ kind: "error", message: res.code === "INVALID_INPUT" ? "Check your name and email, then try again." : DOWN });
        return;
      }
      const first = res.name ?? name.trim().split(" ")[0];
      setState({ kind: "done", name: first });
      setTimeout(() => router.push("/welcome"), 700);
    } catch (err) {
      setState({ kind: "error", message: err instanceof AdapterError ? DOWN : "Something went wrong. Try again." });
    }
  }

  async function withGoogle() {
    setState({ kind: "busy" });
    try {
      const res = await adapters.auth.signInWithProvider("google");
      if (!res.ok) {
        setState({ kind: "error", message: res.message ?? DOWN });
        return;
      }
      router.push("/welcome");
    } catch {
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
          <Link href="/welcome" className={styles.cta}>Open Knowvia</Link>
        </div>
      </div>
    );
  }
  const busy = state.kind === "busy";
  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate aria-label="Get access">
      <div className={styles.title}>Get access in 10 seconds</div>
      <button type="button" className={styles.ghost} onClick={withGoogle} disabled={busy}>
        <BrandLogo id="google" size={24} />Continue with Google
      </button>
      <div className={styles.or} aria-hidden><span />or<span /></div>
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
      <button type="submit" className={styles.btn} disabled={busy}>{busy ? "Getting you in…" : "Get access"}</button>
      {state.kind === "error" ? <p className={styles.err} role="alert">{state.message}</p> : null}
      <div className={styles.note}><span>No card needed. Leave any time.</span><a href="#">Privacy</a></div>
    </form>
  );
}
