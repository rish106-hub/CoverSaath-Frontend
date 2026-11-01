"use client";

import { useTheme } from "./ThemeProvider";
import styles from "./ThemeButton.module.css";

/** Small icon control for the app top bar. Settings keeps the full Light or Dark choice. */
export function ThemeButton() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button type="button" className={styles.btn} onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        {dark ? (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
          </>
        ) : (
          <path d="M16.5 11.5A6.5 6.5 0 0 1 8.5 3.5a6.5 6.5 0 1 0 8 8Z" />
        )}
      </svg>
    </button>
  );
}
