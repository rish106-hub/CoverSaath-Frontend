import { existsSync } from "node:fs";
import path from "node:path";
import styles from "./logos.module.css";

export const OFFICIAL_IDS = ["digilocker", "abdm", "abha", "e-raktkosh", "outlook", "teams", "slack"] as const;
const LABELS: Record<string, string> = {
  digilocker: "DigiLocker", abdm: "ABDM", abha: "ABHA", "e-raktkosh": "e-RaktKosh", outlook: "Outlook", teams: "Teams", slack: "Slack",
};

/** Looks for public/logos/<id>.svg|png at render time; otherwise shows a neutral name tile. Server component. */
export function OfficialLogo({ id, size = 32 }: { id: string; size?: number }) {
  const label = LABELS[id] ?? id;
  const dir = path.join(process.cwd(), "public", "logos");
  const ext = ["svg", "png"].find((e) => existsSync(path.join(dir, `${id}.${e}`)));
  if (ext) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.tile} src={`/logos/${id}.${ext}`} alt={label} width={size} height={size} style={{ objectFit: "contain" }} />;
  }
  return (
    <span className={styles.name} style={{ minHeight: size }} role="img" aria-label={label}>
      {label}
    </span>
  );
}
