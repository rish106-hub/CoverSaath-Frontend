import { DemoGate } from "@/components/shell/EmptyState";
import { PolicyList } from "@/components/cover/PolicyList";
import { RealPolicies } from "@/components/cover-real/RealPolicies";

export const metadata = { title: "My policies" };

export default function Page() {
  return <DemoGate empty={<RealPolicies />}><PolicyList /></DemoGate>;
}
