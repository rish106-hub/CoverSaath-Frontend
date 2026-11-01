import { PageTitle, Kicker } from "@/components/type";
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
      <MoneyDesk />
    </>
  );
}
