// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

import UiGalleryPage from "@/app/dev/ui/page";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); notFound.mockClear(); });

describe("dev page", () => {
  it("dev page 404 in prod", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => UiGalleryPage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    notFound.mockClear();
    vi.stubEnv("NODE_ENV", "development");
    expect(() => render(<UiGalleryPage />)).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
