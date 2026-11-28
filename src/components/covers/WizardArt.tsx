// The three drawn pictures of the add-a-policy wizard: a document being read, a family, a payment card. They exist so each
// screen shows what is happening instead of bare text. Shapes are ported from the approved canvas; they are decorative only
// (hidden from assistive tech), carry no motion, and take every colour from theme tokens through wizard.module.css.
import s from "./wizard.module.css";

export type WizardArtKind = "doc" | "family" | "pay";

export function WizardArt({ kind }: { kind: "doc" | "family" | "pay" }) {
  return (
    <svg className={s.art} data-art={kind} aria-hidden="true" focusable="false" viewBox="0 0 320 240">
      {kind === "doc" ? (
        <>
          <rect className={s.artGround} x="86" y="22" width="150" height="196" rx="16" />
          <rect className={s.artAccent} x="108" y="52" width="76" height="12" rx="6" />
          <path className={s.artLine} d="M108 88h106M108 112h106M108 136h70" />
          <rect className={s.artWarm} x="108" y="164" width="52" height="30" rx="8" />
          <path className={s.artLine} d="M52 122h216" />
          <circle className={s.artAccent} cx="258" cy="46" r="20" />
          <path className={s.artLineOnAccent} d="M249 46l6 6 12-13" />
        </>
      ) : null}
      {kind === "family" ? (
        <>
          <circle className={s.artAccent} cx="160" cy="78" r="34" />
          <rect className={s.artAccent} x="110" y="124" width="100" height="96" rx="40" />
          <circle className={s.artGround} cx="72" cy="112" r="26" />
          <rect className={s.artGround} x="34" y="148" width="76" height="72" rx="30" />
          <circle className={s.artWarm} cx="250" cy="112" r="26" />
          <rect className={s.artGround} x="212" y="148" width="76" height="72" rx="30" />
          <path className={s.artLine} d="M24 226h272" />
        </>
      ) : null}
      {kind === "pay" ? (
        <>
          <rect className={s.artGround} x="46" y="52" width="228" height="140" rx="20" />
          <rect className={s.artAccent} x="46" y="84" width="228" height="26" />
          <rect className={s.artWarm} x="70" y="140" width="56" height="30" rx="8" />
          <path className={s.artLine} d="M150 150h92M150 166h60" />
          <circle className={s.artAccent} cx="262" cy="188" r="26" />
          <path className={s.artLineOnAccent} d="M250 188l9 9 16-17" />
        </>
      ) : null}
    </svg>
  );
}
