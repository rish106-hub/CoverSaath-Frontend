import { PageTitle, Kicker } from "@/components/type";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { pageFor } from "@/lib/ia";

export const metadata = { title: "Calculators and top-ups" };

export default function Page() {
  const page = pageFor("/tools");
  return (
    <>
      <div>
        {page?.kicker ? <Kicker>{page.kicker}</Kicker> : null}
        <PageTitle>{page?.title ?? "Free tools. No sign-up."}</PageTitle>
      </div>
      <ToolsPage />
    </>
  );
}
