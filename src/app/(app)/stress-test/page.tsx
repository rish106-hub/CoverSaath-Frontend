import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { StressTest } from "@/components/cover/StressTest";

export const metadata = { title: "Stress test" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="Stress test starts from your own policy" body="Upload your policy and Knowvia reads it for you." />}><StressTest /></DemoGate>;
}
