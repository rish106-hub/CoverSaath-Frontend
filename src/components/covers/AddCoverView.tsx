"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { adapters } from "@/adapters";
import { MAX_UPLOAD_BYTES, POLICY_TYPES, POLICY_TYPE_LABEL, errorText, type PolicyType } from "@/adapters/documents-contract";
import { makeRequestKey, uploads } from "@/adapters/uploads";
import { stageOf } from "@/adapters/covers";
import type { CandidateView, Candidates } from "@/adapters/covers-contract";
import { PageSkeleton } from "@/components/shell/ErrorPanel";
import { ErrorBox } from "@/components/cover-real/parts";
import { BrandMark } from "@/components/brand/BrandMark";
import { Bar, Button, Card, Field, InlineStatus, Signal } from "@/components/ui";
import { codeOf } from "./use-holdings";
import { canRetry, checkSchedule, emptySlot, pickFile, runSchedule, type Slot } from "./add-cover-flow";
import { payments, type PolicySlots } from "@/adapters/payments";
import { confirmPay, payCopy, realPayDeps, runPay, type PayState } from "./pay-flow";
import { POLL_MAX, POLL_MS, STAGE_COPY, STAGE_ORDER, WIZARD_STEPS, guideFor, screenOf, stepOf, type ReadingStage } from "./wizard-copy";
import { PeopleStep } from "./PeopleStep";
import { WizardArt } from "./WizardArt";
import { toPolicyView, type HeadlineLine } from "@/adapters/real-policy";
import s from "./wizard.module.css";

const MB = MAX_UPLOAD_BYTES / 1024 / 1024;
type Pick = { candidateId: string; label: string } | null;

/**
 * Add a policy as a guided journey, one screen per step (screenOf says which): find the PDF, watch it being read, say which plan it is,
 * add the family, done. The view owns the state and calls the adapters through the add-cover and pay helpers; the copy and the screen
 * rules live in wizard-copy.ts. Insurer and plan names only; no registry number is ever shown.
 */
export function AddCoverView() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [policyType, setPolicyType] = useState<PolicyType | "">("personal_health");
  const [typeLocked, setTypeLocked] = useState(false);
  const [schedule, setSchedule] = useState<Slot>(emptySlot);
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidates | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [else_, setElse] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ productId: string; productName: string }[] | null>(null);
  const [done, setDone] = useState(false);
  const [peopleDone, setPeopleDone] = useState(false);
  const [over, setOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const [slots, setSlots] = useState<PolicySlots | null>(null);
  const [pay, setPay] = useState<PayState>({ kind: "idle" });
  // The first read of the person's consent and uploads failed. Kept apart from `error` so the page never falls through to the consent screen on a failed read.
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const scheduleInput = useRef<HTMLInputElement>(null);
  const consentKey = useRef(makeRequestKey());
  const confirmKey = useRef(makeRequestKey());
  // Automatic re-checks already made for the document now being read; counted per document so a new upload starts fresh.
  const polled = useRef<{ documentId: string; count: number }>({ documentId: "", count: 0 });
  const latestCheckAgain = useRef<() => Promise<void>>(async () => undefined);

  const fail = (e: unknown) => setError(codeOf(e));

  // Paid policy slots: the first policy is free; another needs one payment before its schedule can go up (the backend enforces it).
  useEffect(() => {
    let live = true;
    payments.slots().then((r) => { if (live) setSlots(r); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  // A schedule already uploaded whose plan was never chosen (the person left mid-way, or came back from "Choose your plan") is picked
  // up here: its candidates show and no payment is asked, because that policy already holds its slot.
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    let live = true;
    // Only when sent here to finish one ("Choose your plan" links with ?resume=1); a fresh visit uploads a new schedule.
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("resume") !== "1") return () => { live = false; };
    adapters.covers.holdingsView().then(async (view) => {
      const open = view.holdings.find((h) => (h.status === "uploaded" || h.status === "insurer_pending") && !h.summary?.productName);
      if (!live || !open) return;
      setResumed(true);
      setHoldingId(open.id);
      setSchedule((cur) => (cur.status === "empty" ? { ...cur, status: "done", code: null } : cur));
      try { const c = await adapters.covers.candidates(open.id); if (live) setCands(c); } catch { /* the plan search below still works */ }
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const mustPay = !resumed && ((slots !== null && slots.enabled && !slots.canAdd) || schedule.code === "PAYMENT_REQUIRED");

  useEffect(() => {
    let live = true;
    uploads.list().then((r) => {
      if (!live) return;
      setConsent(r.consent);
      if (r.policyType) { setPolicyType(r.policyType); setTypeLocked(true); }
      // A schedule still being checked or read when the page was left or reloaded comes back here, ahead of the payment screen:
      // it already holds its slot. "?resume=1" has its own path above.
      if (!r.consent || new URLSearchParams(window.location.search).get("resume") === "1") return;
      const open = r.documents.find((d) => d.busy && d.kind === "policy_schedule" && d.note !== "DELETING" && d.note !== "QUARANTINED");
      if (!open) return;
      return adapters.covers.holdingsView().then(async (view) => {
        if (!live || view.holdings.some((h) => h.documentId === open.id)) return;
        const slot: Slot = { ...emptySlot(), status: "waiting", documentId: open.id, stage: stageOf(open) };
        setResumed(true);
        setSchedule(slot);
        setBusy(true);
        try {
          const next = await checkSchedule(adapters.covers, slot, (stage) => { if (live) setSchedule((cur) => ({ ...cur, stage })); });
          if (live) await afterSchedule(next);
        } finally {
          if (live) setBusy(false);
        }
      }).catch(() => undefined);
    }).catch((e) => {
      if (!live) return;
      // Consent stays unknown (null): showing the consent screen after a failed read would ask for a go-ahead already given.
      setLoadFailure(codeOf(e));
    });
    return () => { live = false; };
    // afterSchedule only calls setters and the candidates fetch; the first render copy is enough for this once-per-attempt effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  function retryLoad() {
    setLoadFailure(null);
    setLoadAttempt((n) => n + 1);
  }

  async function accept() {
    setBusy(true);
    try {
      await uploads.grantConsent(consentKey.current);
      setConsent(true);
      setError(null);
    } catch (e) {
      fail(e);
      setBusy(false);
      return;
    }
    setBusy(false);
    // A file refused for want of the go-ahead goes up again at once, in the same slot with the same request key.
    if (schedule.code === "CONSENT_REQUIRED" && schedule.file) await retrySchedule();
  }

  async function loadCandidates(id: string) {
    try {
      setCands(await adapters.covers.candidates(id));
      setError(null);
    } catch (e) {
      fail(e);
    }
  }

  async function afterSchedule(r: { slot: Slot; holdingId: string | null }) {
    setSchedule(r.slot);
    if (r.slot.code === "CONSENT_REQUIRED") setConsent(false);
    // The price is needed for the pay screen; if the first read of the slots failed, ask again now that the backend asked for payment.
    if (r.slot.code === "PAYMENT_REQUIRED" && slots === null) payments.slots().then(setSlots).catch(() => undefined);
    if (r.holdingId) {
      setHoldingId(r.holdingId);
      await loadCandidates(r.holdingId);
    }
  }

  async function takeSchedule(file: File | undefined) {
    if (!file || busy || policyType === "") return;
    setBusy(true);
    setError(null);
    setPay({ kind: "idle" });
    try {
      const picked = pickFile(file);
      setSchedule(picked);
      await afterSchedule(await runSchedule(adapters.covers, picked, policyType, (stage) => setSchedule((cur) => (cur.status === "working" ? { ...cur, stage } : cur))));
    } finally {
      setBusy(false);
      if (scheduleInput.current) scheduleInput.current.value = "";
    }
  }

  async function retrySchedule() {
    if (busy || policyType === "") return;
    setBusy(true);
    try {
      setSchedule({ ...schedule, status: "working", code: null });
      await afterSchedule(await runSchedule(adapters.covers, schedule, policyType, (stage) => setSchedule((cur) => (cur.status === "working" ? { ...cur, stage } : cur))));
    } finally {
      setBusy(false);
    }
  }

  async function checkAgain() {
    setBusy(true);
    const onStage = (stage: NonNullable<Slot["stage"]>) => setSchedule((cur) => ({ ...cur, stage }));
    try {
      await afterSchedule(await checkSchedule(adapters.covers, schedule, onStage));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { latestCheckAgain.current = checkAgain; });

  // What happens once a payment is confirmed. The result comes from the pay helpers' return value, not from an effect, so it runs once.
  async function afterPay(result: PayState) {
    if (result.kind !== "paid") return;
    setSlots(result.slots);
    // The file the person already chose goes up now, with the same request key (the refused try stored nothing).
    if (schedule.file && schedule.code === "PAYMENT_REQUIRED" && policyType !== "") await retrySchedule();
    else if (schedule.code === "PAYMENT_REQUIRED") setSchedule(emptySlot());
  }
  async function startPay() {
    setError(null);
    await afterPay(await runPay(realPayDeps(), setPay));
  }
  async function recheckPay(proof: NonNullable<Extract<PayState, { kind: "stopped" }>["proof"]>) {
    await afterPay(await confirmPay(realPayDeps(), proof, setPay));
  }

  async function search() {
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    try {
      const r = await adapters.reference.products({ q: term });
      // Plan names only. The reference row also carries a registry number; it is never shown or kept.
      setFound(r.products.slice(0, 4).map((p) => ({ productId: p.productId, productName: p.productName })));
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pick || !holdingId || !cands) return;
    setBusy(true);
    setChecking(true);
    try {
      await adapters.covers.confirmProduct(holdingId, { candidateId: pick.candidateId, expectedVersion: cands.profileVersion }, confirmKey.current);
      setDone(true);
      setError(null);
    } catch (e) {
      // A new key only after a refusal the person can change; a network failure keeps the key so a retry is the same statement.
      if (["INVALID_INPUT", "HOLDING_PRODUCT_UNSUPPORTED", "POLICY_PROFILE_VERSION_CONFLICT"].includes(codeOf(e))) confirmKey.current = makeRequestKey();
      fail(e);
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  const screen = screenOf({
    consent,
    loadFailed: loadFailure !== null,
    done,
    peopleDone,
    hasCandidates: cands !== null,
    slotStatus: schedule.status,
    slotCode: schedule.code,
    // The pay screen needs the price. If the slots read failed there is nothing to show, so the person stays on the find screen.
    mustPay: mustPay && slots !== null,
    hasHolding: holdingId !== null,
  });
  const step = stepOf(screen);

  // The result screen shows the headline values that were read. One call on arrival; a failed call or a missing holding shows no cards.
  const [coverFacts, setCoverFacts] = useState<HeadlineLine[]>([]);
  useEffect(() => {
    if (screen !== "cover" || holdingId === null) return;
    let live = true;
    adapters.covers.holdingsView().then((view) => {
      const holding = view.holdings.find((hd) => hd.id === holdingId);
      if (!live || !holding) return;
      setCoverFacts(toPolicyView(holding, null).headlines.filter((line) => line.tone === "read" || line.tone === "confirmed").slice(0, 3));
    }).catch(() => undefined);
    return () => { live = false; };
  }, [screen, holdingId]);

  // While a document is still being read, look again every POLL_MS on its own; stop on unmount, when the status changes, or after POLL_MAX tries.
  useEffect(() => {
    if (screen !== "reading" || schedule.status !== "waiting" || busy) return;
    const documentId = schedule.documentId ?? "";
    if (polled.current.documentId !== documentId) polled.current = { documentId, count: 0 };
    if (polled.current.count >= POLL_MAX) return;
    const timer = setTimeout(() => {
      polled.current.count += 1;
      void latestCheckAgain.current();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [screen, schedule.status, schedule.documentId, busy]);

  const label = (c: CandidateView) => `${c.insurerName} – ${c.productName}`;
  const chooseFile = () => scheduleInput.current?.click();
  const signInLink = <Link className={s.link} href="/signin">Sign in</Link>;
  const errorLine = error ? <InlineStatus kind="error">{errorText(error)} {error === "UNAUTHENTICATED" ? signInLink : null}</InlineStatus> : null;
  const heading = (text: string) => <h1 className={s.h1}>{text}</h1>;

  // The picture on the left of the two-column screens; the people screen draws its own in PeopleStep.
  const artKind = screen === "consent" || screen === "find" || screen === "reading" ? "doc" : screen === "pay" ? "pay" : null;

  let content: ReactNode = null;
  let secondary: ReactNode = null;
  let main: ReactNode = null;

  switch (screen) {
    case "loading":
      content = <div role="status" aria-label="Loading your upload page"><PageSkeleton height={160} /></div>;
      break;
    case "load-failed":
      content = <ErrorBox code={loadFailure ?? ""} onRetry={retryLoad} />;
      break;
    case "consent":
      // FOR LEGAL REVIEW: the wording below is not final.
      content = (
        <>
          {heading("Can Knowvia read your policy?")}
          <ul className={s.list}>
            <li>Keep it in your account, in encrypted storage.</li>
            <li>Check it for harmful content.</li>
            <li>Read its text and pull out the cover details, such as sum insured and waiting periods.</li>
          </ul>
          <div><Link className={s.link} href="/privacy">Privacy</Link></div>
          {errorLine}
        </>
      );
      main = <Button size="lg" state={busy ? "busy" : "idle"} busyLabel="Saving" onClick={() => void accept()}>Yes, read my policy</Button>;
      break;
    case "pay": {
      const price = slots ? (slots.pricePaise / 100).toLocaleString("en-IN") : "";
      const running = pay.kind === "opening" || pay.kind === "confirming";
      const stopped = pay.kind === "stopped" ? pay : null;
      // FOR LEGAL REVIEW: price and payment wording.
      content = (
        <div className={s.stack} data-testid="pay-card">
          {heading(`Add another policy for Rs ${price}.`)}
          <p className={s.lead}>Your first policy is free. Each one after that is Rs {price}, paid once.</p>
          {stopped ? (
            <InlineStatus kind="error">{payCopy(pay)} {stopped.code === "UNAUTHENTICATED" ? signInLink : null}</InlineStatus>
          ) : null}
        </div>
      );
      if (running) main = <Button size="lg" state="busy" busyLabel={payCopy(pay)}>Pay Rs {price}</Button>;
      else if (stopped?.proof) { const proof = stopped.proof; main = <Button size="lg" onClick={() => void recheckPay(proof)}>Check again</Button>; }
      else if (!(stopped && !stopped.canPayAgain)) main = <Button size="lg" onClick={() => void startPay()}>Pay Rs {price}</Button>;
      break;
    }
    case "find":
      content = (
        <>
          {heading("Drop your policy PDF here.")}
          <p className={s.lead}>PDF, up to {MB} MB. The schedule page is enough: who is covered, the sum insured and the dates.</p>
          <Field label="Type of policy">
            <select value={policyType} disabled={typeLocked || schedule.status !== "empty"} onChange={(e) => { setPolicyType(e.target.value as PolicyType | ""); setError(null); }} data-testid="policy-type">
              <option value="" disabled>Choose one</option>
              {POLICY_TYPES.map((t) => <option key={t} value={t}>{POLICY_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          {pay.kind === "paid" ? <InlineStatus kind="ok">Paid. You can add your policy now.</InlineStatus> : null}
        </>
      );
      main = <Button size="lg" disabled={busy || policyType === ""} data-slot="policy_schedule" onClick={chooseFile}>Choose PDF</Button>;
      break;
    case "reading": {
      const stage: ReadingStage = schedule.stage ?? "sending";
      const at = STAGE_ORDER.indexOf(stage);
      content = (
        <div className={s.stack} role="status" aria-live="polite" data-state="working" data-stage={stage}>
          <p className={s.percent}>{STAGE_COPY[stage].percent}%</p>
          {heading(STAGE_COPY[stage].h1)}
          <div className={s.bar10}><Bar value={STAGE_COPY[stage].percent / 100} label="Reading your policy" /></div>
          <ol className={s.stages}>
            {STAGE_ORDER.map((key, i) => {
              const state = i < at ? "done" : i === at ? "active" : "todo";
              return (
                <li key={key} className={s.stage} data-step={state}>
                  {state === "done" ? <Signal kind="ok">{STAGE_COPY[key].label}</Signal> : <><span className={s.stageDot} aria-hidden /><span>{STAGE_COPY[key].label}</span></>}
                  {state === "active" ? <span className={s.srOnly}> (in progress)</span> : null}
                </li>
              );
            })}
          </ol>
          {schedule.status === "waiting" ? <p className={s.note}>Still working on it. A long policy can take a minute or two.</p> : null}
          {pay.kind === "paid" ? <InlineStatus kind="ok">Paid. You can add your policy now.</InlineStatus> : null}
        </div>
      );
      if (schedule.status === "waiting") secondary = <Button variant="outline" size="lg" disabled={busy} onClick={() => void checkAgain()}>Check again</Button>;
      break;
    }
    case "guide": {
      const guide = guideFor(schedule.code ?? "");
      content = (
        <div className={s.stack} role="alert" data-state="failed">
          <div className={s.pillRow}><Signal kind="warn" variant="pill">One quick fix</Signal></div>
          {heading(guide.title)}
          {guide.steps.length > 0 ? (
            <ol className={s.fixCards}>
              {guide.steps.slice(0, 3).map((fixStep, i) => (
                <li key={fixStep.title}>
                  <Card>
                    <span className={s.fixNum} aria-hidden="true">{i + 1}</span>
                    <p className={s.fixTitle}>{fixStep.title}</p>
                    <p className={s.fixText}>{fixStep.text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          ) : <p className={s.lead}>{guide.fix}</p>}
          {schedule.file ? <p className={s.note}>{schedule.file.name}</p> : null}
        </div>
      );
      if (guide.action === "another") main = <Button size="lg" disabled={busy} onClick={chooseFile}>Choose another PDF</Button>;
      else if (guide.action === "retry") {
        if (canRetry(schedule)) {
          main = <Button size="lg" disabled={busy} onClick={() => void retrySchedule()}>Try again</Button>;
          secondary = <Button variant="outline" size="lg" disabled={busy} onClick={chooseFile}>Choose another PDF</Button>;
        } else main = <Button size="lg" disabled={busy} onClick={chooseFile}>Choose another PDF</Button>;
      } else if (guide.action === "policies") main = <Link className={s.linkPrimary} href="/policies">Open my policies</Link>;
      else if (guide.action === "signin") main = <Link className={s.linkPrimary} href="/signin">Sign in</Link>;
      else main = <Link className={s.linkPrimary} href="/home">Go to Home</Link>;
      break;
    }
    case "plan": {
      const guesses = cands?.candidates.slice(0, 3) ?? [];
      const top = guesses[0];
      const searchOpen = else_ || guesses.length === 0;
      content = (
        <>
          {heading("Which plan is this?")}
          {top && !else_ ? <p className={s.lead}>We think this is <b>{label(top)}</b>.</p> : <p className={s.lead}>Tell us which plan this is.</p>}
          {guesses.length > 0 && !else_ ? (
            <ul className={s.choices} role="radiogroup" aria-label="Plan choices">
              {guesses.map((c) => (
                <li key={c.candidateId}>
                  <label className={s.choice} data-on={pick?.candidateId === c.candidateId}>
                    <input type="radio" name="plan" checked={pick?.candidateId === c.candidateId} onChange={() => setPick({ candidateId: c.candidateId, label: label(c) })} />
                    <span className={s.choiceText}><b>{c.productName}</b><span>{c.insurerName}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          {guesses.length === 0 && !else_ ? <p className={s.note}>We could not tell from the first pages. Search for it below.</p> : null}
          {searchOpen ? (
            <>
              <div className={s.searchRow}>
                <Field label="Insurer or plan name">
                  <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} maxLength={100} autoComplete="off" />
                </Field>
                <Button variant="outline" size="lg" onClick={() => void search()} disabled={busy || !q.trim()}>Search</Button>
              </div>
              {found?.length === 0 ? <p className={s.note}>Nothing matched. Try fewer words.</p> : null}
              {found && found.length > 0 ? (
                <ul className={s.choices} role="radiogroup" aria-label="Search results">
                  {found.slice(0, 4).map((p) => (
                    <li key={p.productId}>
                      <label className={s.choice} data-on={pick?.candidateId === p.productId}>
                        <input type="radio" name="plan" checked={pick?.candidateId === p.productId} onChange={() => setPick({ candidateId: p.productId, label: p.productName })} />
                        <span className={s.choiceText}><b>{p.productName}</b></span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          {errorLine}
        </>
      );
      secondary = (
        <Button variant="outline" size="lg" aria-expanded={searchOpen} onClick={() => { setElse((v) => !v || guesses.length === 0); setPick(null); }}>
          {else_ ? "Back to our guesses" : "Something else"}
        </Button>
      );
      main = (
        <Button size="lg" disabled={busy || !pick} state={checking ? "busy" : "idle"} busyLabel="Checking your insurer's terms" onClick={() => void confirm()}>
          {pick ? `Yes, it is ${pick.label}` : "Choose a plan"}
        </Button>
      );
      break;
    }
    case "plan-retry":
      content = (
        <>
          {heading("Finding your plan.")}
          {errorLine}
        </>
      );
      main = error === "UNAUTHENTICATED"
        ? <Link className={s.linkPrimary} href="/signin">Sign in</Link>
        : <Button size="lg" onClick={() => void (holdingId ? loadCandidates(holdingId) : undefined)}>Try again</Button>;
      break;
    case "cover": {
      const id = encodeURIComponent(holdingId ?? "");
      content = (
        <>
          <div className={s.pillRow}><Signal kind="ok">Added</Signal></div>
          {heading(`${pick?.label ?? ""} is in.`)}
          {coverFacts.length > 0 ? (
            <ul className={s.facts} data-testid="cover-facts">
              {coverFacts.map((line) => (
                <li key={line.key}>
                  <Card>
                    <p className={s.factLabel}>{line.label}</p>
                    <p className={s.factValue}>{line.value}</p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
          <div role="status"><p className={s.lead}>Your cover is saved.</p></div>
        </>
      );
      secondary = (
        <div className={s.bottomEnd}>
          <Link className={s.linkOutline} href={`/covers/review?holding=${id}`}>See what we found</Link>
          <Link className={s.linkOutline} href={`/covers/declarations?holding=${id}`}>Add health details</Link>
        </div>
      );
      main = <Link className={s.linkPrimary} href={`/policies/${id}`}>Open my policy</Link>;
      break;
    }
    case "people":
      break;
  }

  return (
    <div className={s.frame} data-screen={screen}>
      <header className={s.top}>
        <BrandMark size={28} />
        <ol className={s.steps} aria-label="Steps">
          {WIZARD_STEPS.map((name, i) => (
            <li key={name} className={s.step} aria-current={i + 1 === step ? "step" : undefined} data-done={i + 1 < step ? "true" : undefined}>
              <span className={s.stepNum}>
                {i + 1 < step ? (
                  <>
                    <svg className={s.stepTick} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 10.5l4 4 8-9" /></svg>
                    <span className={s.srOnly}>{i + 1}</span>
                  </>
                ) : i + 1}
              </span>
              {name}
              {i < WIZARD_STEPS.length - 1 ? <span className={s.stepLine} data-reached={i + 1 < step ? "true" : undefined} aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
        <Link className={`${s.linkOutline} ${s.close}`} href="/home">Close</Link>
      </header>
      {screen === "people" ? (
        <PeopleStep onDone={() => setPeopleDone(true)} />
      ) : (
        <>
          <div
            className={s.middle}
            onDragOver={screen === "find" ? (e) => { e.preventDefault(); setOver(true); } : undefined}
            onDragLeave={screen === "find" ? () => setOver(false) : undefined}
            onDrop={screen === "find" ? (e) => { e.preventDefault(); setOver(false); void takeSchedule(e.dataTransfer.files[0]); } : undefined}
          >
            {artKind ? (
              <div className={s.split}>
                <WizardArt kind={artKind} />
                {/* Only the right column is drawn as the dashed drop area on the find screen; a file dropped anywhere on the row is still taken. */}
                <div className={screen === "find" ? `${s.splitRight} ${s.drop}` : s.splitRight} data-over={screen === "find" ? over : undefined}>
                  {content}
                </div>
              </div>
            ) : content}
          </div>
          <div className={s.bottom}>
            <div>{secondary}</div>
            <div>{main}</div>
          </div>
        </>
      )}
      {screen === "find" || screen === "guide" ? (
        <input ref={scheduleInput} aria-label="Policy schedule PDF" data-testid="schedule-input" type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void takeSchedule(e.target.files?.[0])} />
      ) : null}
    </div>
  );
}
