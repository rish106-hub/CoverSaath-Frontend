// ViewportGate: the single screen shown under 1024px wide, where Knowvia does not run (spec Rules 8, R2.6).
// Shown and hidden by CSS media queries only, so there is no flash and no script-based width check.
import { BrandMark } from "@/components/brand/BrandMark";
import styles from "./ViewportGate.module.css";

export function ViewportGate() {
  return (
    <div className={styles.gate} data-testid="viewport-gate">
      <BrandMark size={44} />
      <h1 className={styles.title}>Open Knowvia on a laptop.</h1>
      <p className={styles.text}>Sign in there with the same account. Your cover is waiting.</p>
    </div>
  );
}
