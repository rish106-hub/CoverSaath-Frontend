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
      <DemoGate empty={<RealMoney />}><MoneyDesk /></DemoGate>
    </>
  );
}
