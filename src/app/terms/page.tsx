import { LegalPage } from "@/components/public/LegalPage";

export const metadata = { title: "Terms" };

// FOR LEGAL REVIEW: first-version wording. Not final.
export default function Terms() {
  return (
    <LegalPage title="Terms">
      <p>Knowvia is a private beta. It explains what your policy documents say. It is not insurance advice and does not change your cover.</p>
      <p>Answers come from the documents you add and from public insurer information. Where a detail could not be checked, Knowvia says so. Check important decisions with your insurer.</p>
      <p>You can stop using Knowvia and delete your documents at any time.</p>
    </LegalPage>
  );
}
