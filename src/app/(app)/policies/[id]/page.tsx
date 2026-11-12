import { DemoGate } from "@/components/shell/EmptyState";
import { PolicyReader } from "@/components/cover/PolicyReader";
import { RealPolicyDetail } from "@/components/cover-real/RealPolicyDetail";

export const metadata = { title: "Your policy" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoGate empty={<RealPolicyDetail id={id} />}><PolicyReader id={id} /></DemoGate>;
}
