// Equal-box grid every page composes tiles into. Exists so gaps and column counts are identical on every screen.
import type { ReactNode } from "react";
import styles from "./tiles.module.css";

export function BentoGrid({ cols = 3, split = false, children }: { cols?: 2 | 3; split?: boolean; children: ReactNode }) {
  const variant = split ? styles.split : cols === 2 ? styles.cols2 : styles.cols3;
  return <div className={`${styles.grid} ${variant}`}>{children}</div>;
}
