"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { adapters } from "@/adapters";
import type { WalletPlatform } from "@/adapters";
import { BrandLogo } from "@/components/logos";
import { Kicker, PageTitle } from "@/components/type";
import { SHARE_APPLE, SHARE_OTHER, WALLET_PASSES, WALLET_PEOPLE } from "@/data/mock";
import { PASS_STYLES, PassCard, useQrClock } from "./PassCard";
import styles from "./wallet.module.css";

type Device = "iphone" | "mac" | "android" | "windows";
const DEVICES: [Device, string][] = [["iphone", "iPhone"], ["mac", "Mac"], ["android", "Android"], ["windows", "Windows"]];
const FIRST: Record<WalletPlatform, Device> = { apple: "iphone", google: "android", samsung: "android" };

export function CardsPage() {
  const [who, setWho] = useState("Father");
  const detected = useSyncExternalStore(() => () => undefined, () => adapters.wallet.detect(), () => "apple" as WalletPlatform);
  const [chosen, setDev] = useState<Device | null>(null);
  const dev: Device = chosen ?? (detected === "apple" ? "mac" : FIRST[detected]);
  const [share, setShare] = useState<string | null>(null);
  const { secs, epoch } = useQrClock();

  const card = WALLET_PEOPLE[who]!;
  const apple = dev === "iphone" || dev === "mac";
  const shares = apple ? SHARE_APPLE : SHARE_OTHER;
  const back: [string, string][] = [
    ["Insured", `${card.full} · ${card.blood}`],
    ["Policy", `${card.no} · ${card.insurerShort}`],
    ["Cashless approval", "Planned: before admission. Emergency: within 24 hours."],
    ["Room limit", card.room],
    ["Co-pay", card.copay],
    ["Family contact", "Meera Rao · shared from Knowvia"],
  ];
  const logoFor: Record<string, "apple" | "google" | "samsung"> = { apple: "apple", google: "google", samsung: "samsung" };

  return (
    <div className={styles.cards}>
      <div className={styles.top}>
        <div>
          <Kicker>E-card, in your wallet</Kicker>
          <PageTitle>Show this at any hospital desk.</PageTitle>
        </div>
        <div className={styles.seg} role="group" aria-label="Whose card">
          {Object.keys(WALLET_PEOPLE).map((n) => (
            <button key={n} type="button" aria-pressed={who === n} className={`${styles.segB} ${who === n ? styles.segOn : ""}`} onClick={() => { setWho(n); setShare(null); }}>{n}</button>
          ))}
        </div>
      </div>
      <div className={styles.devs}>
        <span>You’re on</span>
        {DEVICES.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={dev === id} className={`${styles.chip} ${dev === id ? styles.chipOn : ""}`} onClick={() => { setDev(id); setShare(null); }}>{label}</button>
        ))}
        <span>· we detect this automatically</span>
      </div>
      <div className={styles.passes}>
        {WALLET_PASSES.map((w) => (
          <div key={w.id} className={styles.passCol}>
            <div className={styles.passName}><BrandLogo id={logoFor[w.id]!} size={32} />{w.name}<span className={styles.mono} style={{ marginLeft: "auto", color: "var(--graphite)" }}>{w.fmt}</span></div>
            <PassCard card={card} style={PASS_STYLES[w.id]!} secs={secs} epoch={epoch} />
            <div className={styles.passNote}>{w.note}</div>
          </div>
        ))}
      </div>
      <div className={styles.lower}>
        <div className={styles.panel}>
          {apple ? (
            <div className={styles.added}>
              <span className={styles.tick} aria-hidden>✓</span>
              <div><h2 className={styles.panelT}>Added to Apple Wallet</h2><div className={styles.panelD}>It opens from the lock screen near the hospital. Updates itself when cover changes.</div></div>
            </div>
          ) : dev === "android" ? (
            <div><h2 className={styles.panelT}>Add to your wallet</h2>
              <div className={styles.row} style={{ marginTop: 12 }}><span className={`${styles.chip} ${styles.chipOn}`}>Add to Google Wallet</span><span className={styles.chip}>Add to Samsung Wallet</span></div></div>
          ) : (
            <div><h2 className={styles.panelT}>Send it to your phone</h2><div className={styles.panelD}>Downloaded. Pick how you usually send things to yourself; we open the app on this computer.</div></div>
          )}
          <div className={styles.shares}>
            {shares.map((s) => (
              <button key={s} type="button" aria-pressed={share === s} className={`${styles.share} ${share === s ? styles.shareOn : ""}`} onClick={() => setShare(s)}>{s}</button>
            ))}
          </div>
          {share ? <div className={styles.msg} role="status">Opening {share} with {card.full}’s e-card attached. Send it to yourself and tap it on your phone to add it to your wallet.</div> : null}
        </div>
        <div className={styles.back}>
          <h2 className={styles.backT}>On the back of the pass</h2>
          {back.map(([k, v]) => <div key={k} className={styles.backRow}><span>{k}</span><span>{v}</span></div>)}
          <Link href="/emergency" className={styles.backLink}>Open emergency for {who} →</Link>
        </div>
      </div>
    </div>
  );
}
