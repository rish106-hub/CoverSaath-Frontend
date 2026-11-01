"use client";

import Link from "next/link";
import { BackendDown, useMe } from "@/components/shell";
import { Kicker, PageTitle } from "@/components/type";
import { WELCOME_STEPS as STEPS } from "./steps";


export function WelcomeIntro() {
  const { state, retry } = useMe();
  if (state.status === "down") return <BackendDown onRetry={retry} />;
  const first = state.status === "ready" ? state.me.owner.displayName.split(" ")[0] : "";
  return (
    <>
      <div>
        <Kicker>Welcome</Kicker>
        <PageTitle>{first ? `You’re in, ${first}.` : "You’re in."}</PageTitle>
      </div>
      <Link href="/welcome/add" style={{ color: "var(--harbour)", fontWeight: 600 }}>Add your first policy →</Link>
      <Link href="/home" style={{ color: "var(--graphite)" }}>Go to your home</Link>
    </>
  );
}

export function WelcomeStep({ slug }: { slug: string }) {
  const step = STEPS.find((s) => s.slug === slug);
  if (!step) return null;
  return (
    <div>
      <Kicker>{step.kicker}</Kicker>
      <PageTitle>{step.title}</PageTitle>
    </div>
  );
}
