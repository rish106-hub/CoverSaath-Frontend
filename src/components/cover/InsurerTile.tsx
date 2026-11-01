import styles from "./InsurerTile.module.css";

/** Initials tile for an insurer (board .logo). Same in both themes. */
export function InsurerTile({ code, size = 40 }: { code: string; size?: number }) {
  return (
    <span className={styles.tile} style={{ width: size, height: size, fontSize: Math.max(13, Math.round(size * 0.3)) }} aria-hidden>
      {code}
    </span>
  );
}
