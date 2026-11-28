"use client";
// AskBar: the always-visible question field under the page (spec R2.5). It hands the question to /chat, which owns the answer,
// so the bar itself never calls a provider and holds no conversation state.
import { useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import styles from "./AskBar.module.css";

const LABEL = "Ask about your cover";

export function AskBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // /chat is the assistant itself and /emergency must stay uncluttered; /emergency-contacts is a different page, so match exactly.
  if (pathname?.startsWith("/chat") || pathname === "/emergency") return null;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const question = text.trim();
    if (!question) {
      inputRef.current?.focus();
      return;
    }
    router.push("/chat?q=" + encodeURIComponent(question));
    setText("");
  };
  return (
    <form role="search" aria-label={LABEL} className={styles.bar} onSubmit={onSubmit}>
      <input ref={inputRef} type="text" className={styles.input} placeholder={LABEL} aria-label={LABEL} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      <Button type="submit" arrow>Ask</Button>
    </form>
  );
}
