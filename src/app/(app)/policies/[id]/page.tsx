import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { PolicyReader } from "@/components/cover/PolicyReader";

export const metadata = { title: "Your policy" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoGate empty={<EmptyState title="Policy not found" body="This policy is not on your account. Upload your policy to see it here." />}><PolicyReader id={id} /></DemoGate>;
}
