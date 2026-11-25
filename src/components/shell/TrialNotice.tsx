"use client";

import { useState, useSyncExternalStore } from "react";
import { googleSignIn } from "@/adapters";
import { useMe } from "./useMe";
import styles from "./TrialNotice.module.css";

const KEY = "kv_trial_notice_dismissed";
const read = () => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Small dismissible notice for a name+email trial session only (the backend marks it; Google and demo never see it). */
export function TrialNotice() {
  const { state } = useMe();
  const stored = useSyncExternalStore(() => () => {}, read, () => true);
  const [closed, setClosed] = useState(false);
  if (state.status !== "ready" || state.me.trial !== true || stored || closed) return null;
  const close = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked: stays closed for this page view only */
    }
  };
  return (
    // DRAFT - FOR LEGAL REVIEW: trial and data-keeping wording.
    <div className={styles.notice} role="status" data-testid="trial-pill">
      <span>
        You’re on a trial. Your data is not kept after you sign out.
        {googleSignIn ? <> <a href="/api/app/auth/google">Sign in with Google</a> to keep it.</> : null}
      </span>
      <button type="button" className={styles.x} onClick={close} aria-label="Dismiss trial notice" data-testid="trial-pill-dismiss">×</button>
    </div>
  );
}
