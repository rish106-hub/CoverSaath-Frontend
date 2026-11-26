"use client";

import { useTheme } from "./ThemeProvider";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const target = theme === "dark" ? "Light" : "Dark";
  // The accessible name must start with the visible word (WCAG 2.5.3) so voice-control users can say it.
  return (
    <button type="button" className={styles.toggle} onClick={toggle} aria-label={`${target}, switch colour theme`}>
      <span aria-hidden>◐</span> {target}
    </button>
  );
}
