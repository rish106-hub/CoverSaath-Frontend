"use client";

import { useCallback, useState } from "react";
import { useSingleFlight } from "@/lib/use-single-flight";
import styles from "./SaveState.module.css";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Runs a save one at a time and tracks its state. A failed save leaves the caller's input untouched. */
export function useSave() {
  const flight = useSingleFlight();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const save = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      const ok = await flight.run(async () => {
        setStatus("saving");
        try {
          await fn();
          if (flight.alive()) setStatus("saved");
          return true;
        } catch {
          if (flight.alive()) setStatus("error");
          return false;
        }
      });
      return ok === true;
    },
    [flight],
  );
  const reset = useCallback(() => setStatus("idle"), []);
  return { status, save, busy: flight.busy, reset };
}

/** "Saving", "Saved" or "Could not save. Retry" next to a control. */
export function SaveState({ status, onRetry }: { status: SaveStatus; onRetry?: () => void }) {
  return (
    <span className={styles.state} aria-live="polite" data-status={status}>
      {status === "saving" ? "Saving" : null}
      {status === "saved" ? "Saved" : null}
      {status === "error" ? (
        <>
          Could not save.{" "}
          {onRetry ? (
            <button type="button" className={styles.retry} onClick={onRetry}>Retry</button>
          ) : (
            "Retry"
          )}
        </>
      ) : null}
    </span>
  );
}
