import { DemoGate } from "@/components/shell/EmptyState";
import { StressTest } from "@/components/cover/StressTest";
import { RealStress } from "@/components/cover-real/RealStress";

export const metadata = { title: "Stress test" };

export default function Page() {
  return <DemoGate empty={<RealStress />}><StressTest /></DemoGate>;
}
