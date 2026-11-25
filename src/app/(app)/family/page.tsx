import { SoonBento } from "@/components/soon/SoonBento";
import { DemoGate } from "@/components/shell/EmptyState";
import { Kicker } from "@/components/type";
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
        {page.kicker ? <Kicker>{page.kicker}</Kicker> : null}
        <FamilyTitle demo={page.title} />
      </div>
      <DemoGate empty={<><RealFamily /><SoonBento tiles={[{ label: "People and relations" }, { label: "Who is covered by what" }, { label: "Invite family" }]} /></>}><FamilyView /></DemoGate>
    </>
  );
}
