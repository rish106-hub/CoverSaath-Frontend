import { notFound } from "next/navigation";
import { WelcomeStep } from "@/components/access/Welcome";
import { WELCOME_STEPS } from "@/components/access/steps";

export function generateStaticParams() {
  return WELCOME_STEPS.map((s) => ({ step: s.slug }));
}

export default async function Step({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!WELCOME_STEPS.some((s) => s.slug === step)) notFound();
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 48px" }}>
      <WelcomeStep slug={step} />
    </main>
  );
}
