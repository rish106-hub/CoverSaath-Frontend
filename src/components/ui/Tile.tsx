// The one summary box: label, big number, one-line caption, optional meter and source chip.
// Exists so every screen shows facts in equal boxes with the same quiet hover and press behaviour.
import Link from "next/link";
import type { ReactNode } from "react";
import tones from "@/components/public/tones.module.css";
import { Meter, type MeterTone } from "./Meter";
import styles from "./tiles.module.css";

export type TileTone = MeterTone;

export type TileProps = {
  tone?: TileTone;
  label: string;
  value?: ReactNode;
  caption?: string;
  meter?: number;
  source?: string;
  href?: string;
  onClick?: () => void;
};

// plain, ink and marker are defined locally (in-app look); the rest reuse the public tone classes.
const TONE_CLASS: Record<TileTone, string> = {
  plain: styles.plain,
  ink: styles.ink,
  marker: styles.marker,
  signal: tones.signal,
  mist: tones.mist,
  ochre: tones.ochre,
  violet: tones.violet,
  dark: tones.dark,
};

export function Tile({ tone = "plain", label, value, caption, meter, source, href, onClick }: TileProps) {
  const interactive = Boolean(href || onClick);
  const cls = `${styles.tile} ${TONE_CLASS[tone]} ${interactive ? styles.interactive : ""}`.trim();
  const body = (
    <>
      <span className={styles.label}>{label}</span>
      {value !== undefined && value !== null && <span className={styles.value}>{value}</span>}
      {caption && <span className={styles.caption}>{caption}</span>}
      {meter !== undefined && <Meter value={meter} tone={tone} />}
      {source && <span className={styles.source}>{source}</span>}
    </>
  );
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
