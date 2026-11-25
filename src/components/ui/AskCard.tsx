// Dark card that sends a starter question to chat. Exists so every page offers the same one clear next action.
import Link from "next/link";
import styles from "./tiles.module.css";

export function AskCard({ prompts, href = "/chat" }: { prompts: string[]; href?: string }) {
  return (
    <div className={styles.ask}>
      <span className={styles.orb} aria-hidden="true" />
      <p className={styles.askTitle}>Ask about your cover</p>
      <div className={styles.askPrompts}>
        {prompts.slice(0, 2).map((p) => (
          <Link key={p} href={`${href}?q=${encodeURIComponent(p)}`} className={styles.askPrompt}>{p}</Link>
        ))}
      </div>
    </div>
  );
}
