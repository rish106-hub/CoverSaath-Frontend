"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeButton } from "@/components/theme";
import { AgentProvider, AgentLayer } from "@/components/agent";
import { pageFor } from "@/lib/ia";
import { PageHeader } from "./PageHeader";
import { AppSidebar } from "./AppSidebar";
import styles from "./AppShell.module.css";

/**
 * One layout for every app page: pinned sidebar, then the content column.
 * /home has its own greeting, every other page starts with the breadcrumb and page tabs.
 * `dock` is the slot for the Ask Knowvia dock (W1).
 */
export function AppShell({ pathname: given, children, dock }: { pathname?: string; children: ReactNode; dock?: ReactNode }) {
  const current = usePathname();
  const pathname = given ?? current ?? "/home";
  const home = pageFor(pathname)?.route === "/home";
  return (
    <AgentProvider>
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <AppSidebar pathname={pathname} />
      <div className={styles.main}>
        <div className={styles.bar}><ThemeButton /></div>
        {home ? null : <PageHeader pathname={pathname} />}
        <main id="main-content" tabIndex={-1} className={`${styles.content} route-in`}>{children}</main>
      </div>
      {dock ? <div className={styles.dock}>{dock}</div> : null}
      <AgentLayer />
    </div>
    </AgentProvider>
  );
}
