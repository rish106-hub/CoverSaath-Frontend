import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { Compare } from "@/components/cover/Compare";

export const metadata = { title: "Compare plans" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="Compare starts from your own policy" body="Upload your policy and Knowvia reads it for you." />}><Compare /></DemoGate>;
}
