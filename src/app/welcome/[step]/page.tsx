import { notFound } from "next/navigation";
import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { RealUserToUpload } from "@/components/onboarding/RealUserToUpload";
import { OnboardingFlow } from "@/components/onboarding/Flow";
import { WELCOME_STEPS } from "@/components/access/steps";

export function generateStaticParams() {
  return WELCOME_STEPS.map((s) => ({ step: s.slug }));
}

export default async function Step({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!WELCOME_STEPS.some((s) => s.slug === step)) notFound();
  // Every step is the demo walk-through. A real account is sent to the upload flow, so it never sees sample policy, people or wins; nothing shows while the session loads.
  return (
    <RealUserToUpload>
      <DemoGate empty={<EmptyState title="Nothing read yet" body="Add a policy first. What Knowvia finds in it shows here." />}>
        <OnboardingFlow slug={step} />
      </DemoGate>
    </RealUserToUpload>
  );
}
