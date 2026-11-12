import { describe, expect, it } from "vitest";
import Page from "@/app/(app)/upload/page";

describe("/upload", () => {
  it("redirects to the one add-a-cover journey", () => {
    let digest = "";
    try {
      Page();
    } catch (e) {
      digest = String((e as { digest?: string }).digest);
    }
    expect(digest).toMatch(/^NEXT_REDIRECT;\w+;\/covers\/add;/);
  });
});
