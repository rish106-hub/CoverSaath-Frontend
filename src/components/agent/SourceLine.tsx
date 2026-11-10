import type { AssistantReply } from "@/adapters";
import styles from "./AskChat.module.css";

/** One small line under an answer: where it came from. Nothing for replies that carry no source information (navigation, small talk). */
export function SourceLine({ sources, status }: { sources?: AssistantReply["sources"]; status?: AssistantReply["answerStatus"] }) {
  if (!sources || sources.length === 0) return null;
  const found = sources.filter((s) => s.tier !== "none");
  if (found.length === 0 || status === "unknown") return <p className={styles.source}>Not found in your documents</p>;
  return (
    <>
      {found.slice(0, 2).map((s, i) => (
        <p key={`${s.evidenceId ?? s.label}-${i}`} className={styles.source}>
          {s.tier === "household_evidence" ? `From your document${s.page ? `, page ${s.page}` : ""}` : s.label}
          {s.quote ? <><span className={styles.srOnly}>Quote from the document: </span><q>{s.quote}</q></> : null}
        </p>
      ))}
    </>
  );
}
