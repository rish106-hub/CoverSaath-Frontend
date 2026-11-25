"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeButton } from "@/components/theme";
import { AgentProvider, AgentLayer, HeaderMic } from "@/components/agent";
import { groupOf, pageFor } from "@/lib/ia";
import { signInUrl } from "@/lib/return-path";
import { PageHeader } from "./PageHeader";
import { AppSidebar } from "./AppSidebar";
import { useMe } from "./useMe";
import { TrialNotice } from "./TrialNotice";
import styles from "./AppShell.module.css";

/**
 * One layout for every app page: pinned sidebar, then the content column.
 * /home has its own greeting, every other page starts with the breadcrumb and page tabs.
 * `dock` is the slot for the Ask Knowvia dock (W1).
 */
export function AppShell({ pathname: given, children, dock }: { pathname?: string; children: ReactNode; dock?: ReactNode }) {
  const current = usePathname();
  const router = useRouter();
  const { state } = useMe();
  const signedOut = state.status === "signed-out";
  const pathname = given ?? current ?? "/home";
  useEffect(() => {
    // Keep the page the person was on, so signing in again brings them back to it (the helper drops any unsafe path).
    if (signedOut) router.replace(signInUrl({ path: pathname }));
  }, [signedOut, router, pathname]);
  const home = pageFor(pathname)?.route === "/home";
  return (
    <AgentProvider>
    <div className={styles.shell} data-group={groupOf(pathname)}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <AppSidebar pathname={pathname} />
      <div className={styles.main}>
        <div className={styles.bar}><HeaderMic /><ThemeButton /></div>
        <TrialNotice />
        {home ? null : <PageHeader pathname={pathname} />}
        <main id="main-content" tabIndex={-1} className={`${styles.content} k-content`}>{children}</main>
      </div>
      {dock ? <div className={styles.dock}>{dock}</div> : null}
      <AgentLayer />
    </div>
    </AgentProvider>
  );
}
