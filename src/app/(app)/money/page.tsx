import { SoonBento } from "@/components/soon/SoonBento";
import { DemoGate } from "@/components/shell/EmptyState";
import { PageTitle, Kicker } from "@/components/type";
import { RealMoney } from "@/components/money/RealMoney";
import { MoneyDesk } from "@/components/money/MoneyDesk";
import { pageFor } from "@/lib/ia";

export const metadata = { title: "Money desk" };

export default function Page() {
  const page = pageFor("/money");
  return (
    <>
      <div>
        {page?.kicker ? <Kicker>{page.kicker}</Kicker> : null}
        <PageTitle>{page?.title ?? "Money desk"}</PageTitle>
      </div>
      <DemoGate empty={<><RealMoney /><SoonBento tiles={[{ label: "Premiums this year" }, { label: "Tax you can save (80D)" }, { label: "Receipts" }, { label: "Renewal reminders" }, { label: "Claims paid" }, { label: "Download 80D pack" }]} /></>}><MoneyDesk /></DemoGate>
    </>
  );
}
