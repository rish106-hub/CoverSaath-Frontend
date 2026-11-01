import { notFound } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/Flow";
import { WELCOME_STEPS } from "@/components/access/steps";

export function generateStaticParams() {
  return WELCOME_STEPS.map((s) => ({ step: s.slug }));
}

export default async function Step({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!WELCOME_STEPS.some((s) => s.slug === step)) notFound();
  return <OnboardingFlow slug={step} />;
}
