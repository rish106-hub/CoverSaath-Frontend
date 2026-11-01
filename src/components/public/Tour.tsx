"use client";

import { TOUR_NAV, TOUR_SCENES } from "@/data/mock";
import tones from "./tones.module.css";
import styles from "./landing.module.css";

const BAR: Record<string, string> = { ink: "var(--harbour)", soft: "var(--sea-glass)", signal: "var(--signal)", ochre: "var(--ochre)", dark: "var(--ink)" };

/** Real mini-screens for the tour. `scene` and `tick` (0-3) are owned by the landing page. */
export function Tour({ scene, tick, play, onPick, onToggle }: { scene: number; tick: number; play: boolean; onPick: (i: number) => void; onToggle: () => void }) {
  const sc = TOUR_SCENES[scene] ?? TOUR_SCENES[0]!;
  return (
    <section className={styles.tour} aria-label="Tour of the app">
      <div className={styles.chrome}>
        <span className={styles.lights} aria-hidden>
          <i style={{ background: "#e9785d" }} /><i style={{ background: "#e3b85a" }} /><i style={{ background: "#6fa79e" }} />
        </span>
        <span className={styles.url}>app.knowvia.in / {sc.path}</span>
        <button type="button" className={styles.play} onClick={onToggle} aria-pressed={!play}>{play ? "❚❚ Pause" : "▶ Play"}</button>
      </div>
      <div className={styles.screen} aria-live="off">
        <div className={styles.snav} aria-hidden>
          <span className={styles.snavBrand}>Knowvia</span>
          {TOUR_NAV.map((n, k) => <span key={n} className={`${styles.snavItem} ${k === sc.nav ? styles.snavOn : ""}`}>{n}</span>)}
        </div>
        <div className={styles.sbody} key={sc.path}>
          <div className={styles.shead}><span className={styles.stitle}>{sc.title}</span><span className={styles.stag}>{sc.tag}</span></div>
          <div className={styles.tiles}>
            {sc.tiles.map(([k, v, tone]) => (
              <div key={k} className={`${styles.tile} ${tones[tone]}`}><span className={styles.tileK}>{k}</span><span className={styles.tileV}>{v}</span></div>
            ))}
          </div>
          <div className={styles.split}>
            <div className={styles.bars}>
              {sc.bars.map(([t, w, c, v]) => (
                <div key={t} className={styles.bar}>
                  <span>{t}</span>
                  <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${w}%`, background: BAR[c] }} /></span>
                  <span className={styles.barV}>{v}</span>
                </div>
              ))}
            </div>
            <div className={styles.ask}>
              <span className={styles.askHead}><span className={styles.orb} />Ask Knowvia</span>
              <span className={styles.say}>“{sc.say}”</span>
              <span className={styles.reply}>{sc.reply}</span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.scenes}>
        {TOUR_SCENES.map((x, k) => (
          <button key={x.t} type="button" className={`${styles.scene} ${k === scene ? styles.sceneOn : ""}`} onClick={() => onPick(k)} aria-current={k === scene ? "true" : undefined}>
            <span className={styles.strip}><i style={{ width: `${k < scene ? 100 : k === scene ? (tick + 1) * 25 : 0}%` }} /></span>
            {x.t}
          </button>
        ))}
      </div>
    </section>
  );
}
