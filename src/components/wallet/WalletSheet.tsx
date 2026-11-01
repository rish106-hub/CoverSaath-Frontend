"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adapters } from "@/adapters";
import type { WalletPlatform } from "@/adapters";
import { BrandLogo } from "@/components/logos";
import { WALLET_PASSES, WALLET_PEOPLE, SHARE_CHANNELS } from "@/data/mock";
import { useSingleFlight } from "@/lib/use-single-flight";
import { orderWallets } from "@/lib/wallet-detect";
import { PASS_STYLES, PassCard, useQrClock } from "./PassCard";
import styles from "./wallet.module.css";

const LOGO = { apple: "apple", google: "google", samsung: "samsung" } as const;
const LOVED = [["R", "Rohan"], ["L", "Mother"], ["S", "Father"]] as const;

/** "Save card to wallet" dialog. The detected wallet comes first; the others sit under "Other wallets". */
export function WalletSheet({ onClose }: { onClose: () => void }) {
  const [detected] = useState<WalletPlatform>(() => adapters.wallet.detect());
  const [added, setAdded] = useState<WalletPlatform | null>(null);
  const [error, setError] = useState("");
  const [to, setTo] = useState<Record<string, boolean>>({ R: true });
  const [channel, setChannel] = useState("WhatsApp");
  const { secs, epoch } = useQrClock();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { run, busy, alive } = useSingleFlight();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { first, others } = useMemo(() => orderWallets(detected), [detected]);
  const card = WALLET_PEOPLE.Meera!;
  const count = Object.values(to).filter(Boolean).length;

  function add(p: WalletPlatform) {
    return run(async () => {
      setError("");
      try {
        await adapters.wallet.pass(p);
        if (alive()) setAdded(p);
        // Remember the wallet in the stored onboarding progress. Android wallets (Google, Samsung) share one value.
        const saved = await adapters.onboarding.get();
        await adapters.onboarding.save({ ...(saved ?? { completed: false }), wallet: p === "apple" ? "apple" : "google" });
      } catch {
        if (alive()) setError("Could not save that. Try again.");
      }
    });
  }
  const option = (p: WalletPlatform, recommended: boolean) => {
    const meta = WALLET_PASSES.find((w) => w.id === p)!;
    return (
      <button key={p} type="button" className={`${styles.wopt} ${recommended ? styles.woptRec : ""} ${added === p ? styles.woptOn : ""}`} onClick={() => add(p)} disabled={busy}>
        <BrandLogo id={LOGO[p]} size={40} />
        <span>
          {recommended ? <span className={styles.rec}>Recommended</span> : null}
          <span className={styles.woptT}>{meta.name}</span>
          <span className={styles.woptD}>{p === "apple" ? "iPhone, Apple Watch, Mac" : p === "google" ? "Android phones" : "Galaxy phones"}</span>
        </span>
        <span className={styles.woptState}>{added === p ? "Added ✓" : "Add"}</span>
      </button>
    );
  };

  return (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Save your e-card">
        <PassCard card={card} style={PASS_STYLES.apple!} secs={secs} epoch={epoch} />
        <div className={styles.sheetRight}>
          <div className={styles.sheetHead}>
            <h2 className={styles.sheetT}>Save your e-card</h2>
            <button ref={closeRef} type="button" className="k-btn k-btn--sm" onClick={onClose}>Close</button>
          </div>
          {option(first, true)}
          <details className={styles.others}>
            <summary>Other wallets</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>{others.map((p) => option(p, false))}</div>
          </details>
          {error ? <p role="alert" style={{ color: "var(--signal-ink)", font: "500 14px var(--font-sans)", margin: 0 }}>{error}</p> : null}
          <div className={styles.block}>
            <div className={styles.blockHead}><span className={styles.blockT}>Share with family</span></div>
            <div className={styles.row}>
              {LOVED.map(([id, n]) => (
                <button key={id} type="button" aria-pressed={!!to[id]} className={`${styles.chip} ${to[id] ? styles.chipOn : ""}`} onClick={() => setTo({ ...to, [id]: !to[id] })}>
                  <span className={styles.avatar} aria-hidden>{id}</span>{n}
                </button>
              ))}
            </div>
            <div className={styles.row}>
              {SHARE_CHANNELS.map((c) => (
                <button key={c} type="button" aria-pressed={channel === c} className={`${styles.chip} ${channel === c ? styles.chipOn : ""}`} onClick={() => setChannel(c)}>{c}</button>
              ))}
            </div>
            <div className={styles.msg} role="status">{count ? `Ready to send on ${channel} to ${count} ${count === 1 ? "person" : "people"}.` : "Pick who should have your e-card."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
