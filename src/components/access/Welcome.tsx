"use client";

import Link from "next/link";
import { BackendDown, useMe } from "@/components/shell";
import { Kicker, PageTitle } from "@/components/type";
import { WELCOME_STEPS as STEPS } from "./steps";
import styles from "./welcome.module.css";


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
      <ol className={styles.steps}>
        <li><Link href="/covers/add" className={styles.step}>1. Add your policy</Link></li>
        <li><Link href="/family" className={styles.step}>2. Add your family</Link></li>
        <li><Link href="/stress-test" className={styles.step}>3. See what you&apos;d pay</Link></li>
      </ol>
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
