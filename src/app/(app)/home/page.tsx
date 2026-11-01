import { HomeGreeting } from "@/components/shell";
import { HomeView } from "@/components/cover/HomeView";

export const metadata = { title: "Overview" };

export default function Page() {
  return (
    <>
      <HomeGreeting />
      <HomeView />
    </>
  );
}
