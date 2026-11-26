// Route for the household cover memory: one page that shows a family's whole cover across every policy.
// It only mounts CoverMemory; loading, cleaning and error states live there and in the BFF.

import { CoverMemory } from "@/components/cover-real/CoverMemory";

export const metadata = { title: "Cover memory" };

export default function Page() {
  return (
    <>
      <h1>Cover memory</h1>
      <CoverMemory />
    </>
  );
}
