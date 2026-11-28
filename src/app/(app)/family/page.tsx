import { DemoGate } from "@/components/shell/EmptyState";
import { FamilyTitle } from "@/components/family/FamilyTitle";
import { FamilyView } from "@/components/family";
import { RealFamily } from "@/components/family/RealFamily";
import { pageFor } from "@/lib/ia";

export const metadata = { title: "People and invites" };

export default function Page() {
  const page = pageFor("/family");
  if (!page) return null;
  return (
    <>
      <div>
        <FamilyTitle demo={page.title} />
      </div>
      <DemoGate empty={<RealFamily />}><FamilyView /></DemoGate>
    </>
  );
}
