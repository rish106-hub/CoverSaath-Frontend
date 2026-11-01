import styles from "./agent.module.css";

/** Small "V" keycap. Hidden on touch screens, where there is no keyboard to press. */
export function KeyHint({ className = "" }: { className?: string }) {
  return <kbd aria-hidden className={`${styles.keyHint} ${className}`}>V</kbd>;
}
