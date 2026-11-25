// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SoonButton } from "@/components/ui/SoonButton";
import { BarList } from "@/components/ui/BarList";
import { AskCard } from "@/components/ui/AskCard";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { BentoGrid } from "@/components/ui/BentoGrid";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ui parts", () => {
  it("soon button", () => {
    const fn = vi.fn();
    // Extra handler is cast in on purpose: the button must ignore it.
    const props = { onClick: fn } as unknown as { children: string };
    render(<SoonButton {...props}>Add</SoonButton>);
    const el = screen.getByTitle("Coming soon");
    expect(el.getAttribute("aria-disabled")).toBe("true");
    expect(el.textContent).toContain("Add");
    expect(el.textContent).toContain("Soon");
    fireEvent.click(el);
    expect(fn).not.toHaveBeenCalled();
  });

  it("bar list", () => {
    const { container } = render(<BarList rows={[{ label: "A", pct: 80, value: "₹8L" }, { label: "B", pct: 20, value: "₹2L" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    for (const t of ["A", "B", "₹8L", "₹2L"]) expect(screen.getByText(t)).toBeTruthy();
    const widths = Array.from(container.querySelectorAll<HTMLElement>("[style]")).map((e) => e.style.width);
    expect(widths).toEqual(["80%", "20%"]);
    cleanup();
    expect(() => render(<BarList rows={[]} />)).not.toThrow();
  });

  it("ask card", () => {
    const { container } = render(<AskCard prompts={["a", "b", "c"]} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/chat?q=a", "/chat?q=b"]);
    expect(screen.queryByText("c")).toBeNull();
    cleanup();
    const spaced = render(<AskCard prompts={["what is x"]} />);
    expect(spaced.container.querySelector("a")?.getAttribute("href")).toBe("/chat?q=what%20is%20x");
    cleanup();
    const base = render(<AskCard prompts={["a"]} href="/ask" />);
    expect(base.container.querySelector("a")?.getAttribute("href")).toBe("/ask?q=a");
  });

  it("count up", async () => {
    vi.useFakeTimers();
    const format = vi.fn((n: number) => `₹${Math.round(n)}`);
    const { container } = render(<CountUp to={1200} format={format} ms={100} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(container.textContent).toBe("₹1200");
    expect(format).toHaveBeenCalledWith(1200);
  });

  it("reveal grid", () => {
    const a = render(<BentoGrid cols={2}><Reveal><div>kid</div></Reveal></BentoGrid>);
    expect(screen.getByText("kid")).toBeTruthy();
    expect(a.container.firstElementChild?.className).toContain("cols2");
    cleanup();
    const b = render(<BentoGrid split><div>kid</div></BentoGrid>);
    expect(b.container.firstElementChild?.className).toContain("split");
  });
});
