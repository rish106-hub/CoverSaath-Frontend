import { DemoGate } from "@/components/shell/EmptyState";
import { ReviewView } from "@/components/cover/ReviewView";
import { RealReview } from "@/components/cover-real/RealReview";

export const metadata = { title: "Things to check" };

export default function Page() {
  return <DemoGate empty={<RealReview />}><ReviewView /></DemoGate>;
}
