// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { adapters } from "@/adapters";
import { invalidateMe } from "@/components/shell/useMe";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/covers/add",
}));

import { AppShell } from "@/components/shell/AppShell";

beforeEach(() => { replace.mockClear(); invalidateMe(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AppShell sign-in redirect", () => {
  it("keeps the page the person was on, and puts no email or name in the URL", async () => {
    vi.spyOn(adapters.household, "me").mockResolvedValue(null);
    render(<AppShell>page</AppShell>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/signin?next=%2Fcovers%2Fadd"));
    expect(replace.mock.calls[0]?.[0]).not.toMatch(/email|name/);
  });
});
