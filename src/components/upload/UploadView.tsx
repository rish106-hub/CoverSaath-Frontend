"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdapterError } from "@/adapters/types";
import { backendUploads, makeRequestKey, precheck } from "@/adapters/uploads";
import { DOCUMENT_KINDS, MAX_LARGE_UPLOAD_BYTES, MAX_UPLOAD_BYTES, NOTE_TEXT, POLICY_TYPES, POLICY_TYPE_LABEL, errorText, type DocView, type DocumentKind, type PolicyType, type StepState } from "@/adapters/documents-contract";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import styles from "./UploadView.module.css";

const KIND_LABEL: Record<DocumentKind, string> = { policy_wording: "Policy wording", policy_schedule: "Policy schedule", endorsement: "Endorsement" };
const STEPS = [
  ["uploaded", "Uploaded"],
  ["scanned", "Checked"],
  ["reading", "Reading"],
  ["structured", "Cover details"],
] as const;
const STATE_WORD: Record<StepState, string> = { pending: "waiting", active: "in progress", done: "done", failed: "stopped", unavailable: "not available" };
const RETRY_NOTES = new Set(["READING_FAILED", "READING_UNAVAILABLE", "STRUCTURING_FAILED", "STRUCTURING_UNAVAILABLE"]);
const POLL_MS = 3000;
const SLOW_POLL_MS = 15_000;

type Queued = { id: string; file: File; kind: DocumentKind; policyType: PolicyType; key: string; state: "uploading" | "failed"; code?: string };
const codeOf = (e: unknown) => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");
const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function Stepper({ doc }: { doc: DocView }) {
  return (
    <ol className={styles.steps} aria-label="Progress">
      {STEPS.map(([key, label]) => {
        const s = doc.steps[key];
        return (
          <li key={key} className={styles.step} data-state={s}>
            <span className={styles.dot} aria-hidden="true" />
            <span>{label}</span>
            <span className={styles.srOnly}>{STATE_WORD[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function UploadView() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [large, setLarge] = useState(false);
  const [docs, setDocs] = useState<DocView[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentKind>("policy_wording");
  const [policyType, setPolicyType] = useState<PolicyType | "">("");
  const [typeLocked, setTypeLocked] = useState(false);
  const [over, setOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const consentKey = useRef(makeRequestKey());
  const polling = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await backendUploads.list();
      setConsent(r.consent);
      setLarge(r.largeUpload);
      setDocs(r.documents);
      if (r.policyType) { setPolicyType(r.policyType); setTypeLocked(true); }
      setError(null);
    } catch (e) {
      setError(codeOf(e));
      setConsent((c) => c ?? false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    backendUploads.list().then((r) => {
      if (!live) return;
      setConsent(r.consent);
      setLarge(r.largeUpload);
      setDocs(r.documents);
      if (r.policyType) { setPolicyType(r.policyType); setTypeLocked(true); }
    }).catch((e) => {
      if (!live) return;
      setError(codeOf(e));
      setConsent(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const working = docs.filter((d) => d.busy);
  const onlyQuarantined = working.length > 0 && working.every((d) => d.note === "QUARANTINED");
  useEffect(() => {
    if (working.length === 0) return;
    const timer = setInterval(async () => {
      if (polling.current || document.hidden) return;
      polling.current = true;
      try {
        await load();
        // Scanned documents move one step on per tick; the server decides what that step is.
        const scanned = working.filter((d) => d.steps.scanned === "done" && d.note !== "DELETING");
        const next = await Promise.all(scanned.map((d) => backendUploads.advance(d.id).catch(() => null)));
        setDocs((cur) => cur.map((d) => next.find((n) => n?.id === d.id) ?? d));
      } finally {
        polling.current = false;
      }
    }, onlyQuarantined ? SLOW_POLL_MS : POLL_MS);
    return () => clearInterval(timer);
    // `working` is derived from docs; the key below restarts the timer when the set of busy documents changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working.map((d) => `${d.id}:${d.steps.scanned}`).join(","), onlyQuarantined, load]);

  async function accept() {
    setBusy(true);
    try {
      await backendUploads.grantConsent(consentKey.current);
      setConsent(true);
      setError(null);
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function send(item: Queued) {
    setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "uploading", code: undefined } : x)));
    try {
      const doc = await backendUploads.upload(item.file, item.kind, item.key, item.policyType);
      setQueue((q) => q.filter((x) => x.id !== item.id));
      setDocs((d) => (d.some((x) => x.id === doc.id) ? d.map((x) => (x.id === doc.id ? doc : x)) : [doc, ...d]));
    } catch (e) {
      const code = codeOf(e);
      if (code === "CONSENT_REQUIRED") setConsent(false);
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "failed", code } : x)));
    }
  }

  function add(files: FileList | File[]) {
    setError(null);
    if (policyType === "") {
      setError("POLICY_TYPE_REQUIRED");
      return;
    }
    for (const file of Array.from(files)) {
      const id = makeRequestKey();
      const pre = precheck(file, large ? MAX_LARGE_UPLOAD_BYTES : MAX_UPLOAD_BYTES);
      if (pre) {
        setQueue((q) => [...q, { id, file, kind, policyType, key: id, state: "failed", code: pre }]);
        continue;
      }
      const item: Queued = { id, file, kind, policyType, key: id, state: "uploading" };
      setQueue((q) => [...q, item]);
      void send(item);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(codeOf(e));
    }
  }

  const retry = (d: DocView) => act(async () => {
    const next = await backendUploads.advance(d.id, true);
    setDocs((cur) => cur.map((x) => (x.id === next.id ? next : x)));
  });
  const remove = (d: DocView) => act(async () => {
    await backendUploads.remove(d.id);
    setConfirmDelete(null);
    setDocs((cur) => cur.filter((x) => x.id !== d.id));
    await load();
  });
  const withdraw = () => act(async () => {
    await backendUploads.revokeConsent();
    setConfirmWithdraw(false);
    setAgreed(false);
    consentKey.current = makeRequestKey();
    await load();
  });

  return (
    <>
      <div>
        <Kicker>Your family’s cover</Kicker>
        <PageTitle>Add a policy</PageTitle>
      </div>

      {error ? (
        <p className={styles.alert} role="alert">
          {errorText(error)} {error === "UNAUTHENTICATED" ? <Link href="/signin">Sign in</Link> : null}
        </p>
      ) : null}

      {consent === null ? <p className={styles.quiet} role="status">Loading...</p> : null}

      {consent === false ? (
        // DRAFT for legal review: wording below is not final.
        <SectionHeading title="Before we start">
          <div className={styles.card}>
            <p className={styles.lead}>To read your policy we need to do three things with the file you add.</p>
            <ul className={styles.list}>
              <li>Keep it in your account, in encrypted storage.</li>
              <li>Check it for harmful content.</li>
              <li>Read its text with our reading service and pull out the cover details, such as sum insured and waiting periods.</li>
            </ul>
            <p className={styles.lead}>Nothing is read until you say yes. You can delete a document or withdraw this at any time, and what we read from it is erased.</p>
            <label className={styles.check}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>Yes, you can do this with the documents I add.</span>
            </label>
            <button type="button" className="k-btn k-btn--primary" disabled={!agreed || busy} onClick={accept}>
              {busy ? "Saving..." : "Continue"}
            </button>
          </div>
        </SectionHeading>
      ) : null}

      {consent ? (
        <SectionHeading title="Your policy PDF" description={`PDF only, up to ${large ? 15 : 4} MB.`}>
          <div
            className={styles.drop}
            data-over={over}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
          >
            <p className={styles.lead}>Drop your policy here</p>
            <div className={styles.row}>
              <label className={styles.kind}>
                <span>Type of policy</span>
                <select value={policyType} required disabled={typeLocked} onChange={(e) => { setPolicyType(e.target.value as PolicyType | ""); setError(null); }} data-testid="policy-type">
                  <option value="" disabled>Choose one</option>
                  {POLICY_TYPES.map((t) => <option key={t} value={t}>{POLICY_TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className={styles.kind}>
                <span>This is a</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
                  {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
              </label>
              <button type="button" className="k-btn k-btn--primary" disabled={policyType === ""} onClick={() => input.current?.click()}>Choose a PDF</button>
            </div>
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              data-testid="file-input"
              onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }}
            />
          </div>

          {queue.length > 0 ? (
            <ul className={styles.items} aria-label="Files being added">
              {queue.map((q) => (
                <li key={q.id} className={styles.item}>
                  <div className={styles.itemHead}>
                    <span className={styles.name}>{q.file.name}</span>
                    <span className={styles.meta}>{mb(q.file.size)}</span>
                  </div>
                  {q.state === "uploading" ? <p className={styles.quiet} role="status">Uploading...</p> : (
                    <>
                      <p className={styles.alert} role="alert">{errorText(q.code ?? "")}</p>
                      <div className={styles.row}>
                        {q.code === "FILE_TYPE_INVALID" || q.code === "FILE_TOO_LARGE" || q.code === "FILE_EMPTY" || q.code === "PDF_PROTECTED" || q.code === "PDF_UNREADABLE" || q.code === "PDF_ACTIVE_CONTENT" || q.code === "PDF_TOO_LONG" || q.code === "PDF_TOO_COMPLEX" || q.code === "DUPLICATE_DOCUMENT" ? null : (
                          <button type="button" className="k-btn k-btn--secondary k-btn--sm" onClick={() => send(q)}>Try again</button>
                        )}
                        <button type="button" className="k-btn k-btn--sm" onClick={() => setQueue((x) => x.filter((i) => i.id !== q.id))}>Dismiss</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </SectionHeading>
      ) : null}

      {docs.length > 0 ? (
        <SectionHeading title="Your documents">
          <ul className={styles.items}>
            {docs.map((d) => (
              <li key={d.id} className={styles.item} data-testid="doc">
                <div className={styles.itemHead}>
                  <span className={styles.name}>{KIND_LABEL[d.kind as DocumentKind] ?? "Document"}</span>
                  <span className={styles.meta}>{mb(d.sizeBytes)}</span>
                </div>
                <Stepper doc={d} />
                {d.note ? <p className={d.note === "QUARANTINED" || d.note === "DELETING" ? styles.quiet : styles.alert} role="status">{NOTE_TEXT[d.note]}</p> : null}
                <div className={styles.row}>
                  {d.note && RETRY_NOTES.has(d.note) ? <button type="button" className="k-btn k-btn--secondary k-btn--sm" onClick={() => retry(d)}>Try again</button> : null}
                  {d.note === "DELETING" ? null : confirmDelete === d.id ? (
                    <>
                      <span className={styles.quiet}>Delete this document?</span>
                      <button type="button" className="k-btn k-btn--danger k-btn--sm" onClick={() => remove(d)}>Yes, delete</button>
                      <button type="button" className="k-btn k-btn--sm" onClick={() => setConfirmDelete(null)}>Keep</button>
                    </>
                  ) : (
                    <button type="button" className="k-btn k-btn--sm" onClick={() => setConfirmDelete(d.id)}>Delete</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionHeading>
      ) : null}

      {consent ? (
        <SectionHeading title="Your permission">
          {confirmWithdraw ? (
            <div className={styles.row}>
              <span className={styles.quiet}>Withdraw permission? What we read from your documents is erased.</span>
              <button type="button" className="k-btn k-btn--danger k-btn--sm" onClick={withdraw}>Yes, withdraw</button>
              <button type="button" className="k-btn k-btn--sm" onClick={() => setConfirmWithdraw(false)}>Keep</button>
            </div>
          ) : (
            <button type="button" className="k-btn k-btn--sm" onClick={() => setConfirmWithdraw(true)}>Withdraw permission</button>
          )}
        </SectionHeading>
      ) : null}
    </>
  );
}
