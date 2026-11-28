// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Bar, Button, Card, Field, InlineStatus, Ring, Segmented, Signal, Switch, Tabs } from "@/components/ui";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Button", () => {
  it("Button defaults to primary md idle", () => {
    const { container } = render(<Button>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button.tagName).toBe("BUTTON");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).not.toBe("true");
    expect(container.querySelector("[data-spinner]")).toBeNull();
    expect(container.querySelector("[data-tick]")).toBeNull();
  });

  it("Button busy disables, sets aria-busy and shows busyLabel", () => {
    render(<Button state="busy" busyLabel="Saving">Save</Button>);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Saving")).toBeTruthy();
    expect(screen.queryByText("Save")).toBeNull();
  });

  it("Button busy spinner appears only after 250ms", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Button state="busy" busyLabel="Saving">Save</Button>);
    expect(container.querySelector("[data-spinner]")).toBeNull();
    act(() => { vi.advanceTimersByTime(249); });
    expect(container.querySelector("[data-spinner]")).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(container.querySelector("[data-spinner]")).not.toBeNull();
    rerender(<Button state="idle">Save</Button>);
    expect(container.querySelector("[data-spinner]")).toBeNull();
  });

  it("Button done disables and shows tick and doneLabel", () => {
    const { container } = render(<Button state="done" doneLabel="Saved">Save</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("svg[data-tick]")).not.toBeNull();
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("Button arrow appends arrow and hides it when busy or done", () => {
    const a = render(<Button arrow>Next</Button>);
    expect(a.container.textContent).toContain("→");
    cleanup();
    const b = render(<Button arrow state="busy">Next</Button>);
    expect(b.container.textContent).not.toContain("→");
    cleanup();
    const c = render(<Button arrow state="done">Next</Button>);
    expect(c.container.textContent).not.toContain("→");
  });

  it("Button fires onClick when idle and not when busy or done", () => {
    const onClick = vi.fn();
    const a = render(<Button onClick={onClick} type="submit" data-x="1">Go</Button>);
    const button = a.container.querySelector("button")!;
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("data-x")).toBe("1");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    cleanup();
    const b = render(<Button onClick={onClick} state="busy">Go</Button>);
    fireEvent.click(b.container.querySelector("button")!);
    cleanup();
    const c = render(<Button onClick={onClick} state="done">Go</Button>);
    fireEvent.click(c.container.querySelector("button")!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Signal", () => {
  it("Signal dot is aria-hidden and followed by children", () => {
    const { container } = render(<Signal kind="bad">Pay</Signal>);
    const root = container.firstElementChild!;
    expect(root.getAttribute("data-kind")).toBe("bad");
    const dot = root.firstElementChild!;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(dot.nextSibling?.textContent).toBe("Pay");
    expect(screen.getByText("Pay")).toBeTruthy();
  });

  it("Signal pill renders a leading dot and data-kind for every kind", () => {
    const dotClass = render(<Signal kind="ok">T</Signal>).container.firstElementChild!.className;
    cleanup();
    for (const kind of ["ok", "warn", "orange", "bad"] as const) {
      const { container } = render(<Signal kind={kind} variant="pill">T</Signal>);
      const root = container.firstElementChild!;
      expect(root.getAttribute("data-kind")).toBe(kind);
      expect(root.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
      expect(root.firstElementChild?.nextSibling?.textContent).toBe("T");
      expect(root.className).not.toBe(dotClass);
      cleanup();
    }
  });
});

describe("Field", () => {
  it("Field wraps label and control and sets no alert without error", () => {
    const { container } = render(<Field label="Name"><input /></Field>);
    expect(screen.getByLabelText("Name").tagName).toBe("INPUT");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.firstElementChild!.hasAttribute("data-invalid")).toBe(false);
  });

  it("Field error renders role alert and data-invalid", () => {
    const { container } = render(<Field label="Name" error="Required"><input /></Field>);
    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(container.firstElementChild!.hasAttribute("data-invalid")).toBe(true);
    expect(screen.getByLabelText(/Name/)).toBeTruthy();
  });
});

describe("Segmented", () => {
  it("Segmented has group role, aria-label and one button per option", () => {
    render(<Segmented label="Plan" options={["A", "B", "C"]} value="A" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Plan" });
    const buttons = group.querySelectorAll("button");
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["A", "B", "C"]);
  });

  it("Segmented marks the selected option aria-pressed and calls onChange", () => {
    const onChange = vi.fn();
    render(<Segmented label="Plan" options={["A", "B"]} value="B" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "B" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "A" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("A");
  });
});

describe("Switch", () => {
  it("Switch is a role switch named by label and reflects aria-checked", () => {
    const on = render(<Switch label="Alerts" checked onChange={() => {}} />);
    const el = screen.getByRole("switch", { name: "Alerts" });
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("aria-checked")).toBe("true");
    on.unmount();
    render(<Switch label="Alerts" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Alerts" }).getAttribute("aria-checked")).toBe("false");
  });

  it("Switch calls onChange with the toggled value", () => {
    const onChange = vi.fn();
    const a = render(<Switch label="Alerts" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenLastCalledWith(true);
    a.unmount();
    render(<Switch label="Alerts" checked onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe("Card", () => {
  it("Card renders div, a and button and keeps native props", () => {
    const onClick = vi.fn();
    const a = render(<Card>Body</Card>);
    expect(a.container.firstElementChild!.tagName).toBe("DIV");
    expect(screen.getByText("Body")).toBeTruthy();
    cleanup();
    const b = render(<Card as="a" href="/x">Body</Card>);
    expect(b.container.querySelector('a[href="/x"]')).not.toBeNull();
    expect(screen.getByText("Body")).toBeTruthy();
    cleanup();
    const c = render(<Card as="button" onClick={onClick}>Body</Card>);
    expect(c.container.firstElementChild!.tagName).toBe("BUTTON");
    fireEvent.click(c.container.querySelector("button")!);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("Card tone and clickable variants render distinct classes", () => {
    const classOf = (node: React.ReactElement) => {
      const { container } = render(node);
      const name = container.firstElementChild!.className;
      cleanup();
      return name;
    };
    const plain = classOf(<Card>x</Card>);
    const next = classOf(<Card tone="next">x</Card>);
    const inverse = classOf(<Card tone="inverse">x</Card>);
    expect(new Set([plain, next, inverse]).size).toBe(3);
    expect(classOf(<Card as="a" href="/x">x</Card>)).not.toBe(plain);
    expect(classOf(<Card as="button">x</Card>)).not.toBe(plain);
    expect(classOf(<Card as="div">x</Card>)).toBe(plain);
  });
});

describe("Ring", () => {
  it("Ring is an img named by label with the label as centre text", () => {
    render(<Ring value={40} label="40%" />);
    const ring = screen.getByRole("img", { name: "40%" });
    expect(ring.tagName.toLowerCase()).toBe("svg");
    expect(ring.getAttribute("width")).toBe("112");
    expect(ring.querySelector("text")?.textContent).toBe("40%");
  });

  it("Ring default kind is ok at 100 and warn below", () => {
    const kindOf = (node: React.ReactElement) => {
      const { container } = render(node);
      const kind = container.firstElementChild!.getAttribute("data-kind");
      cleanup();
      return kind;
    };
    expect(kindOf(<Ring value={100} label="x" />)).toBe("ok");
    expect(kindOf(<Ring value={99} label="x" />)).toBe("warn");
    expect(kindOf(<Ring value={100} label="x" kind="bad" />)).toBe("bad");
    expect(kindOf(<Ring value={99} label="x" kind="bad" />)).toBe("bad");
  });
});

describe("Bar", () => {
  it("Bar is a progressbar with aria-valuenow 0 to 100 and aria-label", () => {
    const now = (value: number) => {
      render(<Bar value={value} label="Used" />);
      const result = screen.getByRole("progressbar", { name: "Used" }).getAttribute("aria-valuenow");
      cleanup();
      return result;
    };
    expect(now(0.4)).toBe("40");
    expect(now(1)).toBe("100");
    expect(now(0)).toBe("0");
  });

  it("Bar clamps value outside 0 to 1", () => {
    const now = (value: number) => {
      render(<Bar value={value} label="Used" />);
      const result = screen.getByRole("progressbar").getAttribute("aria-valuenow");
      cleanup();
      return result;
    };
    expect(now(1.7)).toBe("100");
    expect(now(-0.3)).toBe("0");
    expect(() => now(NaN)).not.toThrow();
    expect(now(NaN)).toBe("0");
  });
});

describe("InlineStatus", () => {
  it("InlineStatus always renders its container before content", () => {
    const { rerender } = render(<InlineStatus kind="idle">{null}</InlineStatus>);
    const before = screen.getByRole("status");
    rerender(<InlineStatus kind="busy">Saving</InlineStatus>);
    expect(screen.getByRole("status")).toBe(before);
    expect(before.textContent).toContain("Saving");
  });

  it("InlineStatus error uses role alert and other kinds role status", () => {
    render(<InlineStatus kind="error">Failed</InlineStatus>);
    expect(screen.getByRole("alert")).toBeTruthy();
    cleanup();
    for (const kind of ["idle", "busy", "ok"] as const) {
      render(<InlineStatus kind={kind}>Text</InlineStatus>);
      expect(screen.getByRole("status")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      cleanup();
    }
  });

  it("InlineStatus ok shows a tick", () => {
    const hasTick = (kind: "idle" | "busy" | "ok" | "error") => {
      const { container } = render(<InlineStatus kind={kind}>Text</InlineStatus>);
      const found = container.querySelector("svg") !== null;
      cleanup();
      return found;
    };
    expect(hasTick("ok")).toBe(true);
    expect(hasTick("idle")).toBe(false);
    expect(hasTick("busy")).toBe(false);
    expect(hasTick("error")).toBe(false);
  });
});

describe("Tabs", () => {
  const tabs = [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }, { id: "c", label: "Gamma" }];

  it("Tabs has tablist role, aria-label and aria-selected tabs", () => {
    render(<Tabs label="Sections" tabs={tabs} value="b" onChange={() => {}} />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
    const found = screen.getAllByRole("tab");
    expect(found.map((t) => t.textContent)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(found.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
  });

  it("Tabs ArrowRight and ArrowLeft move selection", () => {
    const onChange = vi.fn();
    const a = render(<Tabs label="Sections" tabs={tabs} value="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("b");
    a.unmount();
    render(<Tabs label="Sections" tabs={tabs} value="b" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Beta" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    const calls = onChange.mock.calls.length;
    fireEvent.keyDown(screen.getByRole("tab", { name: "Beta" }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(calls);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Gamma" }), { key: "ArrowRight" });
    for (const [id] of onChange.mock.calls) expect(tabs.map((t) => t.id)).toContain(id);
  });
});
