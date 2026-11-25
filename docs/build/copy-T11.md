# T11 copy pass: exact replacements

Rules behind the table: one word per thing ("policy" is the document you add; "cover" is the protection it gives), a button says what happens, one retry label, contractions, no arrows, no page-name eyebrow above a title that already says it.

## A. Global replacements (every in-scope file, UI strings and page metadata)
| Old | New |
|---|---|
| Add a cover | Add a policy |
| No cover yet | No policy yet |
| Upload your policy | Add a policy |
| Retry | Try again |
| View your covers | View your policies |

## B. Specific replacements
| File | Old | New |
|---|---|---|
| src/components/shell/EmptyState.tsx | Your cover is already on Knowvia. This page cannot use it yet. | Your policy is on Knowvia. This page is coming soon. |
| src/components/shell/ErrorPanel.tsx | That did not load | This didn't load |
| src/components/shell/ErrorPanel.tsx | Your information is safe. Try again, and if it keeps happening, come back in a moment. | Your information is safe. Try again in a moment. |
| src/components/shell/AppSidebar.tsx | Review it → | Review it |
| src/components/cover-real/RealPolicies.tsx | Add your policy and Knowvia reads it for you. It shows here with what was found in it. | Add a policy and what Knowvia finds in it shows here. |
| src/components/cover-real/RealPolicyDetail.tsx | This policy is not on your account. Add your policy to see it here. | This policy isn't on your account. |
| src/components/cover-real/parts.tsx | We are reading this document. Check again in a moment. If nothing changes, add the document again. | We're reading this document. Check again in a moment. |
| src/components/cover-real/MemoryDocument.tsx | What we hold about this policy | Policy summary |
| src/components/cover-real/PassageSearch.tsx | Search the wording | Search your policy wording |
| src/components/covers/AddCoverView.tsx | Next (section title only) | What's next |
| src/components/covers/CoverReviewView.tsx | Facts (section title only) | Details found |
| src/components/covers/CoverReviewView.tsx | Nothing has been read yet. Confirm your plan on Add a cover, then check back. | Nothing read yet. Confirm your plan on Add a policy, then check back. |
| src/components/cover-real/RealStress.tsx | Stress test starts from your own policy | Add a policy to run a stress test |
| src/components/cover-real/RealStress.tsx | Upload your policy and Knowvia reads it for you. | Knowvia reads it, then shows who pays what. |
| src/components/cover-real/RealCompare.tsx | Compare starts from your own policy | Add a policy to compare |
| src/components/cover-real/RealCompare.tsx | Upload your policy and Knowvia reads it for you. | Knowvia reads it, then compares section by section. |
| src/components/cover-real/RealReview.tsx | Upload your policy and Knowvia reads it for you. Anything that needs your decision shows up here. | Anything that needs your decision shows up here. |
| src/components/cover-real/RealReview.tsx | Settle it | Decide |
| src/app/(app)/shortcuts/page.tsx | Shortcuts start from your policy | Add a policy to use shortcuts |
| src/app/(app)/shortcuts/page.tsx | Upload your policy and Knowvia reads it for you. | Knowvia reads it, then shortcuts work on your own policy. |
| src/lib/ia.ts | Every premium and bill, matched. | Premiums and bills |
| src/lib/ia.ts | Free tools. No sign-up. | Calculators |
| src/components/profile/ProfileView.tsx | Could not load your details. Refresh to try again. | Couldn't load your details. Try again. |
| src/components/profile/ProfileView.tsx | Could not load your sources. | Couldn't load your sources. |
| src/components/family/AddMemberSheet.tsx | Could not add them. Try again. | Couldn't add them. Try again. |
| src/app/not-found.tsx | We could not find that page. | We couldn't find that page. |

## C. Eyebrows to remove (delete the Kicker element; keep the title)
| File | Kicker text |
|---|---|
| RealPolicies.tsx, RealPolicyDetail.tsx, AddCoverView.tsx, CoverReviewView.tsx, DeclarationsView.tsx, ChatView.tsx, HospitalsView.tsx | Your family’s cover |
| RealStress.tsx | Stress test |
| RealCompare.tsx | Compare plans |
| RealReview.tsx | Things to check |
| src/lib/ia.ts (kicker field of /money and /tools entries) | Money desk; Calculators and top-ups |

## D. Out of scope for T11 (other branches own these files)
RealHome.tsx, ToolsPage.tsx, SettingsView.tsx, TrialNotice.tsx, Landing.tsx, Tour.tsx, SignIn.tsx, src/data/mock/**, and page.tsx of family, money, cards, compare, desk, stress-test, emergency, assistant.
