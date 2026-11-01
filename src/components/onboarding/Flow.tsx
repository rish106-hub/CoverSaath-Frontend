"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTicker } from "@/lib/use-ticker";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adapters, type UiOnboarding } from "@/adapters";
import { SaveState } from "@/components/ui/SaveState";
import { useAutosave } from "@/lib/use-autosave";
import { Kicker } from "@/components/type";
import dynamic from "next/dynamic";

// Opens from a button on the last step only.
const WalletSheet = dynamic(() => import("@/components/wallet/WalletSheet").then((m) => m.WalletSheet), { ssr: false, loading: () => null });
import { ONBOARD_PEOPLE, ONBOARD_TIPS, ONBOARD_WAYS, ONBOARD_WINS, READING_FINDINGS, READING_SAY, READING_TIPS } from "@/data/mock";
import { WELCOME_STEPS } from "@/components/access/steps";
import tones from "@/components/public/tones.module.css";
import styles from "./onboarding.module.css";

type Row = { icon: string; k: string; v: string; ref: string; disagrees?: boolean };
const LABELS = ["Add", "Reading", "People", "Ready"];

export function OnboardingFlow({ slug }: { slug: string }) {
  const router = useRouter();
  const idx = Math.max(0, WELCOME_STEPS.findIndex((s) => s.slug === slug));
  const step = WELCOME_STEPS[idx]!;
  const [walletOpen, setWalletOpen] = useState(false);
  const last = idx === WELCOME_STEPS.length - 1;
  const ob = useOnboarding(idx);
  const go = (i: number) => router.push(`/welcome/${WELCOME_STEPS[i]!.slug}`);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Knowvia</Link>
        <ol className={styles.stepper} aria-label="Getting started">
          {LABELS.map((t, i) => (
            <li key={t} className={styles.st} aria-current={i === idx ? "step" : undefined}>
              <span className={styles.dotn} style={{ background: i <= idx ? "var(--harbour)" : "var(--line)", color: i <= idx ? "var(--on-harbour)" : "var(--graphite)" }}>{i < idx ? "✓" : i + 1}</span>
              <span className={styles.lab} style={{ color: i === idx ? "var(--ink)" : "var(--graphite)" }}>{t}</span>
              {i < LABELS.length - 1 ? <span className={styles.stLine} aria-hidden /> : null}
            </li>
          ))}
        </ol>
        <Link href="/home" className="k-btn k-btn--sm">Skip to home</Link>
      </header>
      <div className={styles.progress} aria-hidden><div style={{ width: `${((idx + 1) / 4) * 100}%` }} /></div>
      <main className={styles.main}>
        {slug === "reading" ? null : (
          <div>
            <Kicker>{step.kicker}</Kicker>
            <h1 className={styles.h1}>{step.title}</h1>
          </div>
        )}
        {slug === "add" ? <AddStep way={ob.state.way ?? "dl"} onWay={(way) => ob.patch({ way })} status={ob.status} onRetry={ob.retry} /> : null}
        {slug === "reading" ? <ReadingStep /> : null}
        {slug === "people" ? <PeopleStep people={ob.state.people} onToggle={(id, v) => ob.patch({ people: { ...defaultPeople(), ...ob.state.people, [id]: v } })} status={ob.status} onRetry={ob.retry} /> : null}
        {slug === "ready" ? <ReadyStep onWallet={() => setWalletOpen(true)} /> : null}
        <div className={styles.nav}>
          <button type="button" className={`${styles.btn} ${idx === 0 ? styles.btnHidden : ""}`} onClick={() => go(idx - 1)} tabIndex={idx === 0 ? -1 : 0}>Back</button>
          {last ? (
            <Link href="/home" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => ob.patch({ completed: true })}>Go to my home</Link>
          ) : (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => go(idx + 1)}>{idx === 0 ? "Read it" : idx === 1 ? "Continue" : "Looks right"}</button>
          )}
        </div>
      </main>
      {walletOpen ? <WalletSheet onClose={() => setWalletOpen(false)} /> : null}
    </div>
  );
}

const defaultPeople = (): Record<string, boolean> => Object.fromEntries(ONBOARD_PEOPLE.map((p) => [p.id, p.on]));

/** Onboarding progress lives in the backend: loaded on mount, saved on every choice and on each step. */
function useOnboarding(idx: number) {
  const [state, setState] = useState<UiOnboarding>({ completed: false });
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(state);
  const touched = useRef<Partial<UiOnboarding>>({}); // what the person did before the stored progress arrived
  const sv = useAutosave<UiOnboarding>((next) => adapters.onboarding.save(next));
  const { push } = sv;
  const patch = useCallback((p: Partial<UiOnboarding>) => {
    touched.current = { ...touched.current, ...p };
    const next = { ...latest.current, ...p };
    latest.current = next;
    setState(next);
    push(next);
  }, [push]);
  useEffect(() => {
    let live = true;
    adapters.onboarding.get().then(
      (saved) => {
        if (!live) return;
        if (saved) { latest.current = { ...saved, ...touched.current }; setState(latest.current); }
        setLoaded(true);
      },
      () => live && setLoaded(true), // nothing stored or the backend is down: start from the defaults
    );
    return () => { live = false; };
  }, []);
  useEffect(() => {
    // Remember the step this page is. Saved once the stored progress has loaded, so it never overwrites it with defaults.
    if (loaded && latest.current.step !== idx) patch({ step: idx });
  }, [loaded, idx, patch]);
  return { state, patch, status: sv.status, retry: sv.retry };
}

type StepSave = { status: ReturnType<typeof useAutosave>["status"]; onRetry: () => void };

function AddStep({ way, onWay, status, onRetry }: { way: string; onWay: (w: "dl" | "up" | "hr" | "no") => void } & StepSave) {
  return (
    <div className={styles.col}>
      <div className={styles.ways} role="radiogroup" aria-label="How to add your policy">
        {ONBOARD_WAYS.map((w) => (
          <button key={w.id} type="button" role="radio" aria-checked={way === w.id} className={`${styles.opt} ${way === w.id ? styles.optOn : ""}`} onClick={() => onWay(w.id)}>
            <span className={styles.optLogo} aria-hidden>{w.logo}</span>
            <span className={styles.optT}>{w.t}</span>
            <span className={styles.optD}>{w.d}</span>
            <span className={styles.optTime}>{w.time}</span>
          </button>
        ))}
      </div>
      <SaveState status={status} onRetry={onRetry} />
      <div className={styles.drop}>
        <span aria-hidden style={{ fontSize: 22 }}>⇪</span>
        <span>Or drop a PDF, schedule or e-card here</span>
        <span className={styles.dropFmt}>PDF · JPG · PNG</span>
      </div>
      <section aria-label="Can’t find your policy?">
        <h2 style={{ font: "600 20px/1.25 var(--font-sans)", margin: 0, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>Can’t find your policy?</h2>
        <div className={styles.tips} style={{ marginTop: 16 }}>
          {ONBOARD_TIPS.map((t) => (
            <div key={t.t} className={`${styles.tip} ${tones[t.tone]}`}>
              <span className={styles.tipI} aria-hidden>{t.i}</span>
              <span className={styles.tipT}>{t.t}</span>
              <span className={styles.tipD}>{t.d}</span>
              <span className={styles.tipK} style={{ color: t.tone === "mist" ? "var(--harbour)" : undefined }}>{t.k}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Findings from the ReadingAdapter first, then the schedule facts, so the list is never empty. */
function useFindings(): Row[] {
  const [rows, setRows] = useState<Row[]>(READING_FINDINGS.map((f) => ({ ...f })));
  useEffect(() => {
    let live = true;
    adapters.reading.findings("northstar-floater").then((fs) => {
      if (!live || fs.length === 0) return;
      const fromAdapter: Row[] = fs.map((f) => ({ icon: "◎", k: f.label, v: f.answer, ref: f.pageRef, disagrees: f.disagrees }));
      const seen = new Set(fromAdapter.map((r) => r.k));
      setRows([...fromAdapter, ...READING_FINDINGS.filter((f) => !seen.has(f.k)).map((f) => ({ ...f }))].slice(0, 6));
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return rows;
}

function useRevealCount(total: number) {
  const reduce = useReducedMotion();
  const [count, setN] = useState(1);
  useTicker(() => setN((x) => (x >= total ? total : x + 1)), 1400, !reduce);
  return [reduce ? total : Math.min(count, total), setN] as const;
}

function ReadingStep() {
  const rows = useFindings();
  const [n, setN] = useRevealCount(rows.length);
  const [say, setSay] = useState(0);
  const shown = rows.slice(0, n).reverse();
  return (
    <>
    <div>
      <Kicker>{WELCOME_STEPS[1].kicker}</Kicker>
      <h1 className={styles.h1}>{n < rows.length ? "Reading your policy" : `${rows.length} key terms found`}</h1>
    </div>
    <div className={styles.read}>
      <div className={styles.doc} aria-hidden>
        {[92, 80, 96, 60, 88, 74, 94, 52, 86, 90, 70, 82].map((w, i) => <span key={i} style={{ height: 7, width: `${w}%`, borderRadius: 3, background: "var(--sunken)", display: "block" }} />)}
        <span className={styles.sweep} />
        <span className={styles.pageNo}>Page {3 + n * 6} of 42</span>
      </div>
      <div className={styles.found}>
        <div className={styles.foundHead}>
          <span className={styles.foundLab}>Found so far · {n} of {rows.length}</span>
          <button type="button" className="k-btn k-btn--sm" onClick={() => setN(n >= rows.length ? 1 : n + 1)}>Next finding</button>
        </div>
        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((f) => (
            <div key={f.k} className={styles.frow}>
              <span className={styles.fico} aria-hidden>{f.icon}</span>
              <div><div className={styles.fk}>{f.k}</div><div className={styles.fv}>{f.v}</div>{f.disagrees ? <div className={styles.disagree}>Details differ between documents</div> : null}</div>
              <span className={styles.fref}>{f.ref}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.side}>
        <div className={styles.say}>
          <div className={styles.sayHead}><span className={styles.orb} />Ask Knowvia</div>
          <div className={styles.sayLead}>Say anything about this policy. I’ll file it.</div>
          <div className={styles.said}>“{READING_SAY[say]![0]}”</div>
          <div className={styles.filed}>{READING_SAY[say]![1]}</div>
          <div className={styles.sayChips}>
            {READING_SAY.map((x, k) => <button key={x[0]} type="button" className={styles.sayChip} onClick={() => setSay(k)} aria-pressed={k === say}>{x[0].split(" ").slice(0, 4).join(" ")}…</button>)}
          </div>
        </div>
        <div className={styles.know}>
          <div className={styles.knowT}>Did you know</div>
          <div className={styles.knowD}>{READING_TIPS[n % 3]}</div>
        </div>
      </div>
    </div>
    </>
  );
}

function PeopleStep({ people, onToggle, status, onRetry }: { people?: Record<string, boolean>; onToggle: (id: string, v: boolean) => void } & StepSave) {
  const on = { ...defaultPeople(), ...people };
  return (
    <div className={styles.col}>
      <div className={styles.policy}>
        <span className={styles.optLogo} aria-hidden>NH</span>
        <div><div className={styles.policyT}>Northstar Health · Group Mediclaim</div><div className={styles.policyD}>Family floater · Rs 5,00,000 · valid to 31 Mar 2027</div></div>
        <span className={styles.readTag}>Read in 14 s</span>
      </div>
      <div className={styles.people}>
        {ONBOARD_PEOPLE.map((p) => (
          <button key={p.id} type="button" aria-pressed={!!on[p.id]} className={`${styles.person} ${on[p.id] ? styles.personOn : ""}`} onClick={() => onToggle(p.id, !on[p.id])}>
            <span className={styles.ava} aria-hidden>{p.id}</span>
            <span><span className={styles.pn}>{p.n}</span><span className={styles.pr}>{p.rel}</span></span>
            <span className={styles.pm} aria-hidden>{on[p.id] ? "✓" : "+"}</span>
          </button>
        ))}
        <button type="button" className={`${styles.person} ${styles.personAdd}`}><span className={`${styles.ava} ${styles.avaAdd}`} aria-hidden>+</span>Add parents or someone else</button>
      </div>
      <SaveState status={status} onRetry={onRetry} />
    </div>
  );
}

function ReadyStep({ onWallet }: { onWallet: () => void }) {
  return (
    <div className={styles.col}>
      <div className={styles.wins}>
        {ONBOARD_WINS.map((w) => (
          <div key={w.k} className={`${styles.win} ${tones[w.tone]}`}>
            <span className={styles.wk}>{w.k}</span>
            <span className={styles.wv}>{w.v}</span>
            <span className={styles.wd}>{w.d}</span>
            <span className={styles.wr}>{w.ref}</span>
          </div>
        ))}
      </div>
      <div className={styles.wallet}>
        <span>Save your e-card to your phone.</span>
        <button type="button" className="k-btn k-btn--primary" onClick={onWallet}>Save card to wallet</button>
      </div>
    </div>
  );
}
