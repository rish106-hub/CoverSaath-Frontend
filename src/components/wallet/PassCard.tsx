"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { WalletCardData } from "@/data/mock";
import { qrCells } from "./qr";
import styles from "./wallet.module.css";

const PERIOD = 30;

/** Seconds left in the current 30 s window, ticking every second. */
export function useQrClock() {
  const [tick, setTick] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [reduce]);
  return { secs: PERIOD - (tick % PERIOD), epoch: Math.floor(tick / PERIOD) };
}

export type PassStyle = { bg: string; ink: string; accent: string; radius: number };

export function PassCard({ card, style, secs, epoch }: { card: WalletCardData; style: PassStyle; secs: number; epoch: number }) {
  const cells = qrCells(card.no + epoch);
  return (
    <div className={styles.pass} style={{ background: style.bg, color: style.ink, borderRadius: style.radius }}>
      <div className={styles.passHead}>
        <span className={styles.passBrand}><i className={styles.passMark} style={{ background: style.accent }} />Knowvia</span>
        <span className={styles.mono}>{card.insurerShort}</span>
      </div>
      <div>
        <div className={styles.lab}>MEMBER</div>
        <div className={styles.member}>{card.full}</div>
      </div>
      <div className={styles.grid}>
        {([["POLICY NO.", card.no], ["VALID TO", card.valid], ["MEMBER ID", card.mid], ["COVER LEFT", card.left], ["TPA", card.tpa], ["CASHLESS LINE", card.line]] as const).map(([k, v]) => (
          <div key={k}><div className={styles.lab}>{k}</div><div className={k === "TPA" ? undefined : styles.mono}>{v}</div></div>
        ))}
      </div>
      <div className={styles.qrBox}>
        <div className={styles.qr} aria-hidden>
          {cells.map((on, i) => <span key={i} style={{ background: on ? "#16130f" : "#fff" }} />)}
        </div>
        <div className={styles.qrText}>
          <b>Scan at the insurance desk</b>
          <span className={styles.qrMuted}>Refreshes in {secs}s</span>
          <span className={styles.qrTrack}><i style={{ width: `${Math.round((secs / PERIOD) * 100)}%` }} /></span>
          <span className={styles.qrMuted}>Blood group {card.blood} · ABHA linked</span>
        </div>
      </div>
    </div>
  );
}

export const PASS_STYLES: Record<string, PassStyle> = {
  apple: { bg: "#0e4f4a", ink: "#f7f5f0", accent: "#f4dc8a", radius: 18 },
  google: { bg: "#f7f5f0", ink: "#16130f", accent: "#0e4f4a", radius: 24 },
  samsung: { bg: "#16130f", ink: "#f7f5f0", accent: "#e9785d", radius: 14 },
};
