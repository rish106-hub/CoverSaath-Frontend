import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { HomeGreeting } from "@/components/shell";
import { HomeView } from "@/components/cover/HomeView";

export const metadata = { title: "Overview" };

export default function Page() {
  return (
    <>
      <HomeGreeting />
      <DemoGate empty={<EmptyState title="Nothing here yet" body="Upload your policy and Knowvia reads it for you. Your cover summary, renewals and things to check appear here." />}><HomeView /></DemoGate>
    </>
  );
}
