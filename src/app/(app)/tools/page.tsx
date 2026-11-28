import { PageTitle } from "@/components/type";
import { ToolsPage } from "@/components/tools/ToolsPage";
import { pageFor } from "@/lib/ia";

export const metadata = { title: "Calculators and top-ups" };

export default function Page() {
  const page = pageFor("/tools");
  return (
    <>
      <div>
        <PageTitle>{page?.title ?? "Calculators"}</PageTitle>
      </div>
      <ToolsPage />
    </>
  );
}
