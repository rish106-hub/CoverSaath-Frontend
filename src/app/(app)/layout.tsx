import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="kv-app">
      <AppShell>{children}</AppShell>
    </div>
  );
}
