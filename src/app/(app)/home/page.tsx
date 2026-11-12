import { DemoGate } from "@/components/shell/EmptyState";
import { HomeGreeting } from "@/components/shell";
import { HomeView } from "@/components/cover/HomeView";
import { RealHome } from "@/components/cover-real/RealHome";

export const metadata = { title: "Overview" };

export default function Page() {
  return (
    <>
      <HomeGreeting />
      <DemoGate empty={<RealHome />}><HomeView /></DemoGate>
    </>
  );
}
