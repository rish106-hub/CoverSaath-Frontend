import type { ReactNode } from "react";
import styles from "./slots.module.css";

/**
 * Slots for widgets built by W1 (Ask Knowvia strip, RemindRow). W6 swaps the bodies for the real
 * components when the branches merge; the props below are the contract Home relies on.
 */

/** Board Home: the Ask Knowvia strip under the greeting. */
export function AskKnowviaStripSlot({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.slot} data-slot="ask-knowvia-strip">
      {children ?? (
        <>
          <span className={styles.orb} aria-hidden />
          <span className={styles.text}>
            <b>Ask Knowvia anything</b>
            <span>It reads your policies and whatever page you are on.</span>
          </span>
        </>
      )}
    </div>
  );
}

/** Board Home: "Add all N dates" calendar/WhatsApp row under the Your year heading. */
export function RemindRowSlot({ count }: { count: number }) {
  return (
    <div className={styles.remind} data-slot="remind-row">
      <span>Add all {count} dates</span>
      <button type="button" className={styles.chip}>Google Calendar</button>
      <button type="button" className={styles.chip}>Apple Calendar</button>
      <button type="button" className={styles.chip}>WhatsApp reminder</button>
    </div>
  );
}
