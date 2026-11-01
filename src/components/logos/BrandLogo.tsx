import {
  siGoogle, siApple, siGmail, siWhatsapp, siTelegram, siGooglechat, siSignal,
  siGooglemessages, siYoutube, siGooglemaps, siSamsung, siGooglecalendar,
} from "simple-icons";
import styles from "./logos.module.css";

type Icon = { title: string; hex: string; path: string };

const ICONS = {
  google: siGoogle,
  apple: siApple,
  gmail: siGmail,
  whatsapp: siWhatsapp,
  telegram: siTelegram,
  "google-chat": siGooglechat,
  signal: siSignal,
  "google-messages": siGooglemessages,
  youtube: siYoutube,
  "google-maps": siGooglemaps,
  samsung: siSamsung,
  "google-calendar": siGooglecalendar,
} satisfies Record<string, Icon>;

export type BrandId = keyof typeof ICONS;
export const BRAND_IDS = Object.keys(ICONS) as BrandId[];

/** Brand mark in its own colour on a white tile, identical in light and dark. */
export function BrandLogo({ id, size = 32 }: { id: BrandId; size?: number }) {
  const icon: Icon = ICONS[id];
  const inner = Math.round(size * 0.62);
  return (
    <span className={styles.tile} style={{ width: size, height: size }} role="img" aria-label={icon.title}>
      <svg viewBox="0 0 24 24" width={inner} height={inner} fill={`#${icon.hex}`} aria-hidden>
        <path d={icon.path} />
      </svg>
    </span>
  );
}
