"use client";

import Link from "next/link";
import { isValidElement, useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { backendCovers } from "@/adapters/covers";
import type { NavAudience } from "@/lib/ia";
import { useMe } from "./useMe";
import { PageSkeleton } from "./ErrorPanel";
import styles from "./EmptyState.module.css";

/** Where "Upload your policy" goes. One place, so the upload flow can move without touching every page. */
export const UPLOAD_HREF = "/covers/add";

/** An honest empty page: what is missing and the one next action. */
export function EmptyState({ title, body, cta = "Upload your policy", href = UPLOAD_HREF, children }: { title: string; body: string; cta?: string; href?: string; children?: ReactNode }) {
  return (
    <section className={styles.box} aria-label={title} data-testid="empty-state">
      <h2 className={styles.h}>{title}</h2>
      <p className={styles.p}>{body}</p>
      <Link href={href} className={styles.cta}>{cta}</Link>
      {children ? <div className={styles.extra}>{children}</div> : null}
    </section>
  );
}

/** A page that cannot tell empty from unreachable says so and offers one retry, instead of telling the person they have nothing. */
function Unreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <section className={styles.box} aria-label="Can’t reach Knowvia" data-testid="unreachable-state">
      <h2 className={styles.h}>Can’t reach Knowvia right now</h2>
      <p className={styles.p}>Your covers are safe. Try again in a moment.</p>
      <button type="button" className={styles.cta} style={{ border: 0, cursor: "pointer" }} onClick={onRetry}>Try again</button>
    </section>
  );
}

/** Whether `empty` is the generic "Upload your policy" prompt (real-mode pages that draw their own state are left alone). */
const isUploadPrompt = (empty: ReactNode): empty is ReactElement<{ title: string; href?: string }> =>
  isValidElement(empty) && empty.type === EmptyState && (empty.props as { href?: string }).href === undefined;

/** A real account on a page that has no real-data view yet: if it already holds covers, do not ask for an upload. */
function WithHoldings({ empty }: { empty: ReactElement<{ title: string }> }) {
  const [seen, setSeen] = useState<"loading" | "some" | "none" | "failed">("loading");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    backendCovers.holdingsView().then(
      (v) => { if (live) setSeen(v.holdings.length > 0 ? "some" : "none"); },
      (e: { code?: string }) => {
        // A switched-off or unknown holdings route is the backend answering "none yet", not an outage.
        if (live) setSeen(e?.code === "HOLDINGS_DISABLED" || e?.code === "NOT_FOUND" ? "none" : "failed");
      },
    );
    return () => { live = false; };
  }, [tick]);
  const retry = useCallback(() => { setSeen("loading"); setTick((t) => t + 1); }, []);
  if (seen === "loading") return <PageSkeleton />;
  if (seen === "failed") return <Unreachable onRetry={retry} />;
  if (seen === "none") return <>{empty}</>;
  return <EmptyState title={empty.props.title} body="Your cover is already on Knowvia. This page cannot use it yet." cta="View your covers" href="/policies" />;
}

/**
 * Shows `children` (demo or mock content) only to the demo session. Everyone else sees `empty` once we know who they are.
 * While the session is unknown nothing is shown, so demo content can never flash for a real account.
 * A real account is never told to upload a policy it already has, and an unreachable backend shows a retry, not "nothing here".
 */
export function DemoGate({ children, empty }: { children: ReactNode; empty: ReactNode }) {
  const { state, retry } = useMe();
  // A skeleton, not nothing: a blank page reads as broken. It carries no demo content, so none can flash for a real account.
  if (state.status === "loading") return <PageSkeleton />;
  if (state.status === "ready" && state.me.source !== "backend") return <>{children}</>;
  if (state.status === "down") return <Unreachable onRetry={retry} />;
  if (state.status === "ready" && isUploadPrompt(empty)) return <WithHoldings empty={empty} />;
  return <>{empty}</>;
}

/**
 * Which nav a viewer gets. Anything but a confirmed demo session gets the real nav, so demo-only links never flash
 * while the session loads and never show for a backend account.
 */
export function useNavAudience(): NavAudience {
  const { state } = useMe();
  return state.status === "ready" && state.me.source !== "backend" ? "demo" : "real";
}
