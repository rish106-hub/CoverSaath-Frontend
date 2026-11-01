"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme";
import { AgentProvider, AgentLayer } from "@/components/agent";
import { PageHeader } from "./PageHeader";
import { HomeSidebar } from "./HomeSidebar";
import styles from "./AppShell.module.css";

/**
 * /home gets the grouped sidebar; every other app page gets the page header.
 * `dock` is the slot for the Ask Knowvia dock (W1).
 */
export function AppShell({ pathname: given, children, dock }: { pathname?: string; children: ReactNode; dock?: ReactNode }) {
  const current = usePathname();
  const pathname = given ?? current ?? "/home";
  const home = pathname === "/home";
  return (
    <AgentProvider>
    <div className={home ? styles.withSidebar : styles.plain}>
      {home ? <HomeSidebar pathname={pathname} /> : null}
      <div className={styles.main}>
        {home ? null : <PageHeader pathname={pathname} />}
        <main className={`${styles.content} route-in`}>{children}</main>
      </div>
      {dock ? <div className={styles.dock}>{dock}</div> : null}
      <AgentLayer />
      <ThemeToggle />
    </div>
    </AgentProvider>
  );
}
