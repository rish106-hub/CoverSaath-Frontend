import { notFound } from "next/navigation";
import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { OnboardingFlow } from "@/components/onboarding/Flow";
import { WELCOME_STEPS } from "@/components/access/steps";

export function generateStaticParams() {
  return WELCOME_STEPS.map((s) => ({ step: s.slug }));
}

export default async function Step({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!WELCOME_STEPS.some((s) => s.slug === step)) notFound();
  // The add step is for everyone. Reading, people and ready show sample policy results, so only the demo session sees them.
  if (step === "add") return <OnboardingFlow slug={step} />;
  return (
    <DemoGate empty={<EmptyState title="Nothing read yet" body="Add a policy first. What Knowvia finds in it shows here." cta="Upload your policy" href="/welcome/add" />}>
      <OnboardingFlow slug={step} />
    </DemoGate>
  );
}
