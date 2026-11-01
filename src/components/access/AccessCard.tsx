"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adapters, AdapterError } from "@/adapters";
import { SubHeading } from "@/components/type";
import styles from "./AccessCard.module.css";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; name: string } | { kind: "error"; message: string };

/** Minimal beta access card. W2 builds the full Landing page around it. */
export function AccessCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      const res = await adapters.access.submit({ name, email });
      if (!res.ok) {
        setState({ kind: "error", message: res.code === "INVALID_INPUT" ? "Check your name and email, then try again." : "Can’t reach Knowvia right now. Try again in a moment." });
        return;
      }
      const first = res.name ?? name.split(" ")[0];
      setState({ kind: "done", name: first });
      setTimeout(() => router.push("/welcome"), 700);
    } catch (err) {
      setState({ kind: "error", message: err instanceof AdapterError ? "Can’t reach Knowvia right now. Try again in a moment." : "Something went wrong. Try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className={styles.card} role="status">
        <SubHeading>You’re in, {state.name}</SubHeading>
      </div>
    );
  }
  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate>
      <SubHeading>Get access</SubHeading>
      <label className={styles.field}>
        <span>Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <button type="submit" className={styles.btn} disabled={state.kind === "busy"}>{state.kind === "busy" ? "Getting you in…" : "Get access"}</button>
      {state.kind === "error" ? <p className={styles.err} role="alert">{state.message}</p> : null}
      <p className={styles.note}>No card needed. Leave any time.</p>
    </form>
  );
}
