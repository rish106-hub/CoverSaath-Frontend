import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { ReviewView } from "@/components/cover/ReviewView";

export const metadata = { title: "Things to check" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="Nothing to check yet" body="Upload your policy and Knowvia reads it for you. Anything that needs your decision shows up here." />}><ReviewView /></DemoGate>;
}
