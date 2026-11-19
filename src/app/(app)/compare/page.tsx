import { DemoGate } from "@/components/shell/EmptyState";
import { Compare } from "@/components/cover/Compare";
import { RealCompare } from "@/components/cover-real/RealCompare";

export const metadata = { title: "Compare plans" };

export default function Page() {
  return <DemoGate empty={<RealCompare />}><Compare /></DemoGate>;
}
