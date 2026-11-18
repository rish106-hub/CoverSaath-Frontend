import { LegalPage } from "@/components/public/LegalPage";

export const metadata = { title: "Privacy" };

// FOR LEGAL REVIEW: first-version wording, mirrors the in-app consent screen. Not final.
export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <p>Knowvia reads the insurance documents you add so it can explain your cover in plain words.</p>
      <ul>
        <li>Your documents are kept in your account, in encrypted storage.</li>
        <li>They are checked for harmful content.</li>
        <li>Their text is read by our reading service to pull out details such as sum insured and waiting periods.</li>
      </ul>
      <p>Nothing is read until you say yes. You can delete a document or withdraw your consent at any time, and what we read from it is erased.</p>
      <p>Questions about your data: policies@knowvia.in.</p>
    </LegalPage>
  );
}
