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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/welcome/add" className="k-btn k-btn--primary">Add your first policy</Link>
        <Link href="/home" className="k-btn">Go to home</Link>
      </div>
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
