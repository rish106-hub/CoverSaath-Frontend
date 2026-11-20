import type { AssistantReply } from "@/adapters";
import { INSURER_SOURCE, clipQuote, insurerLine } from "@/adapters/insurer-tier";
import styles from "./AskChat.module.css";

/** One small line under an answer: where it came from. Nothing for replies that carry no source information (navigation, small talk).
 *  The insurer's wording is its own line, labelled "From the insurer's wording, not checked" (FOR LEGAL REVIEW), with its page and a
 *  quote of at most 160 characters. It is never shown as the person's own document. */
export function SourceLine({ sources, status }: { sources?: AssistantReply["sources"]; status?: AssistantReply["answerStatus"] }) {
  if (!sources || sources.length === 0) return null;
  const insurer = sources.filter((s) => s.tier === INSURER_SOURCE);
  const found = sources.filter((s) => s.tier !== "none" && s.tier !== INSURER_SOURCE);
  if (found.length === 0 && insurer.length === 0) return <p className={styles.source}>Not found in your documents</p>;
  const own = found.length === 0 || status === "unknown";
  return (
    <>
      {own ? <p className={styles.source}>Not found in your documents</p> : found.slice(0, 2).map((s, i) => (
        <p key={`${s.evidenceId ?? s.label}-${i}`} className={styles.source}>
          {s.tier === "household_evidence" ? `From your document${s.page ? `, page ${s.page}` : ""}` : s.label}
          {s.quote ? <><span className={styles.srOnly}>Quote from the document: </span><q>{s.quote}</q></> : null}
        </p>
      ))}
      {insurer.slice(0, 2).map((s, i) => {
        const quote = clipQuote(s.quote);
        return (
          <p key={`${s.evidenceId ?? "insurer"}-${i}`} className={styles.source} data-source="insurer_wording">
            {insurerLine(s.page)}
            {quote ? <><span className={styles.srOnly}>Quote from the insurer&rsquo;s wording: </span><q>{quote}</q></> : null}
          </p>
        );
      })}
    </>
  );
}
