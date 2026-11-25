// @vitest-environment jsdom
// T2: the single loading placeholder keeps one shape per route family and one accessible label.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Skeleton } from "@/components/ui/Skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("Skeleton renders bento|list|chat shapes", () => {
    const counts: Record<string, number> = {};
    for (const shape of ["bento", "list", "chat"] as const) {
      const { container, unmount } = render(<Skeleton shape={shape} />);
      const root = container.querySelector("[data-skeleton]") as HTMLElement;
      expect(root.getAttribute("role")).toBe("status");
      expect(root.getAttribute("aria-busy")).toBe("true");
      expect(root.querySelector(".sr-only")?.textContent).toBe("Loading");
      counts[shape] = root.querySelectorAll("[aria-hidden]").length;
      unmount();
    }
    // bento: bar + 3 tiles + grid wrapper + wide block = 6; list: bar + 6 rows + wrapper = 8; chat: bar + 3 pills + wrapper + panel = 6.
    expect(counts).toEqual({ bento: 6, list: 8, chat: 6 });
  });
});
