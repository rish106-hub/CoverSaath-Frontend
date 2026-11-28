"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AgentProvider, AgentLayer, AskBar, HeaderMic, useAgent } from "@/components/agent";
import { groupOf } from "@/lib/ia";
import { signInUrl } from "@/lib/return-path";
import { PageHeader } from "./PageHeader";
import { AppSidebar } from "./AppSidebar";
import { ViewportGate } from "./ViewportGate";
import { useMe } from "./useMe";
import styles from "./AppShell.module.css";

/** Top bar: sub-tabs on the left, voice and "Search or jump to" on the right. Lives inside AgentProvider so it can open the palette. */
function TopBar({ pathname }: { pathname: string }) {
  const { setPaletteOpen } = useAgent();
  return (
    <div className={styles.bar}>
      <PageHeader pathname={pathname} />
      <div className={styles.tools}>
        <HeaderMic />
        <button type="button" className={styles.search} onClick={() => setPaletteOpen(true)}>
          Search or jump to <kbd className={styles.kbd}>⌘K</kbd>
        </button>
      </div>
    </div>
  );
}

/**
 * One layout for every app page: pinned rail, a top bar with sub-tabs, the page, then the ask bar.
 * Under 1024px wide the shell is hidden by CSS and the viewport gate is shown instead.
 */
export function AppShell({ pathname: given, children }: { pathname?: string; children: ReactNode }) {
  const current = usePathname();
  const router = useRouter();
  const { state } = useMe();
  const signedOut = state.status === "signed-out";
  const pathname = given ?? current ?? "/home";
  useEffect(() => {
    // Keep the page the person was on, so signing in again brings them back to it (the helper drops any unsafe path).
    if (signedOut) router.replace(signInUrl({ path: pathname }));
  }, [signedOut, router, pathname]);
  return (
    <AgentProvider>
      <div className={styles.shell} data-group={groupOf(pathname)}>
        <a href="#main-content" className={styles.skip}>Skip to content</a>
        <AppSidebar pathname={pathname} />
        <div className={styles.column}>
          <TopBar pathname={pathname} />
          <main id="main-content" tabIndex={-1} className={`${styles.content} k-content`}>{children}</main>
          <AskBar />
        </div>
        <AgentLayer />
      </div>
      <div className={styles.gateWrap}><ViewportGate /></div>
    </AgentProvider>
  );
}
