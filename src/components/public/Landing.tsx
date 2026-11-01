"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { useState } from "react";
import { useTicker } from "@/lib/use-ticker";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import Link from "next/link";
import { AccessCard } from "@/components/access/AccessCard";
import { ThemeToggle } from "@/components/theme";
import { Kicker } from "@/components/type";
import { FAMILY_ALL_YEAR, FAMILY_STATS, LANDING_POINTS } from "@/data/mock";
import dynamic from "next/dynamic";

// The scene player is below the fold on small screens and heavy on mobile CPUs: load it after first paint,
// in a box of the same size so the page does not jump.
const Tour = dynamic(() => import("./Tour").then((m) => m.Tour), {
  ssr: false,
  loading: () => <div className={styles.tourSkel} aria-hidden />,
});
import styles from "./landing.module.css";

/** Beta page: headline, access card, a 20 second tour built from real mini screens, and Meera's family stats. */
export function Landing() {
  const [pos, setPos] = useState({ scene: 0, tick: 0 });
  const { scene, tick } = pos;
  const [wantPlay, setWantPlay] = useState(true);
  const reduce = useReducedMotion();
  const play = wantPlay && !reduce;

  useTicker(() => setPos((p) => (p.tick >= 3 ? { scene: (p.scene + 1) % 5, tick: 0 } : { ...p, tick: p.tick + 1 })), 1000, play);

  const pick = (i: number) => {
    setPos({ scene: i, tick: 0 });
  };
  const story = FAMILY_STATS.find((s) => s.scene === scene) ?? FAMILY_ALL_YEAR;

  return (
    <div className={styles.page}>
      <div className={`${styles.wrap} ${styles.nav}`}>
        <span className={styles.brand}><BrandMark href="/" size={32} /><span className={styles.beta}>Beta</span></span>
        <div className={styles.navRight}>
          <Link href="/emergency" className="k-btn k-btn--sm">Emergency</Link>
          <Link href="/signin" className="k-btn k-btn--primary k-btn--sm">Sign in</Link>
        </div>
      </div>
      <main className={`${styles.wrap} ${styles.main}`}>
        <div className={styles.left}>
          <div>
            <Kicker>Private beta</Kicker>
            <h1 className={styles.h1}>Your health cover, explained in rupees.</h1>
          </div>
          <div className={styles.points}>
            {LANDING_POINTS.map((p) => (
              <div key={p.t} className={styles.point}>
                <span className={styles.pointIcon} aria-hidden>{p.i}</span>
                <span><span className={styles.pointT}>{p.t}</span><span className={styles.pointD}>{p.d}</span></span>
              </div>
            ))}
          </div>
          <AccessCard />
        </div>
        <div className={styles.right}>
          <div className={styles.rowHead}><span className={styles.rowT}>Inside Knowvia</span><span className={styles.rowS}>20-second tour</span></div>
          <Tour scene={scene} tick={tick} play={play} onPick={pick} onToggle={() => setWantPlay(!play)} />
          <section className={styles.stats} aria-label="What Knowvia did for Meera’s family">
            <div className={styles.statsHead}>
              <h2 className={styles.statsT}>Meera’s family this year</h2>
              
            </div>
            <div className={styles.statGrid}>
              {FAMILY_STATS.map((x) => {
                const on = x.scene === scene;
                return (
                  <button key={x.v} type="button" className={`${styles.stat} ${on ? styles.statOn : ""}`} style={{ borderTopColor: on ? x.accent : "transparent" }} onClick={() => pick(x.scene)} aria-pressed={on}>
                    <span className={styles.statV}>{x.v}</span>
                    <span className={styles.statT}>{x.t}</span>
                    <span className={styles.statM} style={on ? { color: x.accent } : undefined}>{x.m}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.story} aria-live="polite"><span className={styles.dot} style={{ background: story.accent }} />{story.story}</div>
          </section>
        </div>
      </main>
      <footer className={styles.foot}>
        <div className={`${styles.wrap} ${styles.footRow}`}>
          <span>© 2026 Knowvia</span>
          <span className={styles.footLinks}><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Contact</a></span>
        </div>
      </footer>
      <div className={styles.themeSlot}><ThemeToggle /></div>
    </div>
  );
}
