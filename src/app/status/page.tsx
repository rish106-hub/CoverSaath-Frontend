import { notFound } from "next/navigation";
import { createBackendClient } from "@/server/backend/client";
import { missingEnv, loadConfig } from "@/server/backend/env";
import { readStatus } from "@/server/backend/service";
import { readSession } from "@/server/backend";
import { PageTitle, Kicker, SectionHeading } from "@/components/type";
import { ThemeToggle } from "@/components/theme";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status" };

export default async function Status() {
  if (process.env.NODE_ENV === "production") notFound();
  const missing = missingEnv();
  let health: boolean | null = null;
  let ready: boolean | null = null;
  let householdId: string | undefined;
  if (missing.length === 0) {
    const config = loadConfig();
    const s = await readStatus(createBackendClient({ baseUrl: config.apiUrl, bootstrapToken: config.bootstrapToken }));
    health = s.health;
    ready = s.ready;
    householdId = (await readSession(config.cookieSecret).catch(() => null))?.h;
  }
  const row = (label: string, v: boolean | null) => (
    <li>{label}: <b>{v === null ? "not checked" : v ? "ok" : "unreachable"}</b></li>
  );
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "64px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <Kicker>Development only</Kicker>
        <PageTitle>Backend status</PageTitle>
      </div>
      <SectionHeading title="Knowvia backend">
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          {row("Health", health)}
          {row("Ready", ready)}
          <li>Household: <b>{householdId ?? "none signed in"}</b></li>
          {missing.length > 0 ? <li>Set in .env.local: <b>{missing.join(", ")}</b></li> : null}
        </ul>
      </SectionHeading>
      <ThemeToggle />
    </main>
  );
}
