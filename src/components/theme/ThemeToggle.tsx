"use client";

import { useTheme } from "./ThemeProvider";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className={styles.toggle} onClick={toggle} aria-label="Switch colour theme">
      <span aria-hidden>◐</span> {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
