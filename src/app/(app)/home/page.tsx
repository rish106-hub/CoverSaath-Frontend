import { HomeGreeting } from "@/components/shell";
import { SectionHeading } from "@/components/type";
import { pageFor } from "@/lib/ia";

export const metadata = { title: "Overview" };

export default function Page() {
  const page = pageFor("/home");
  return (
    <>
      <HomeGreeting />
      {page?.sections.map((s) => <SectionHeading key={s.heading} title={s.heading} description={s.description} />)}
    </>
  );
}
