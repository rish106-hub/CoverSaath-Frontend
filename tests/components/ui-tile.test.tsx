// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tile } from "@/components/ui/Tile";
import { SoonTile } from "@/components/ui/SoonTile";
import { RetryTile } from "@/components/ui/RetryTile";
import { MissingTile } from "@/components/ui/MissingTile";

afterEach(cleanup);

describe("tile", () => {
  it("tile element", () => {
    const fn = vi.fn();
    const a = render(<Tile label="L" href="/x" />);
    expect(a.container.querySelector('a[href="/x"]')).not.toBeNull();
    expect(screen.getByText("L")).toBeTruthy();
    cleanup();
    const b = render(<Tile label="L" onClick={fn} />);
    const btn = b.container.querySelector("button");
    expect(btn).not.toBeNull();
    fireEvent.click(btn!);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(screen.getByText("L")).toBeTruthy();
    cleanup();
    const c = render(<Tile label="L" />);
    expect(c.container.firstElementChild?.tagName).toBe("DIV");
    expect(c.container.querySelector("a")).toBeNull();
    expect(c.container.querySelector("button")).toBeNull();
    expect(screen.getByText("L")).toBeTruthy();
  });

  it("tile content", () => {
    const { container } = render(<Tile label="Sum insured" value="5 L" caption="Per year" meter={40} />);
    expect(screen.getByText("Sum insured")).toBeTruthy();
    expect(screen.getByText("5 L")).toBeTruthy();
    expect(screen.getByText("Per year")).toBeTruthy();
    const meter = container.querySelector('[role="progressbar"]');
    expect(meter?.getAttribute("aria-valuenow")).toBe("40");
    expect((meter?.firstElementChild as HTMLElement).style.width).toBe("40%");
  });

  it("soon tile", () => {
    const { container } = render(<SoonTile label="Claims" caption="x" />);
    const root = screen.getByTitle("Coming soon");
    expect(root.getAttribute("aria-disabled")).toBe("true");
    expect(root.getAttribute("tabindex")).toBe("0");
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText("Claims")).toBeTruthy();
    expect(container.querySelector("[data-value]")).toBeNull();
    expect(root.textContent).toBe("Claimsx" + "Coming soon");
  });

  it("missing tile", () => {
    render(<MissingTile label="Room rent" />);
    expect(screen.getByText("Room rent")).toBeTruthy();
    expect(screen.getByText("Not in your policy")).toBeTruthy();
  });

  it("retry tile", () => {
    const fn = vi.fn();
    render(<RetryTile label="Cover" onRetry={fn} />);
    expect(screen.getByText("Couldn't load")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
