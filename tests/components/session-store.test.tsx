// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { adapters } from "@/adapters";
import { useMe, invalidateMe, ME_TTL_MS } from "@/components/shell/useMe";

const ME = (name: string) => ({ householdId: "h", householdName: "H", owner: { id: "o", displayName: name } }) as never;

function Probe({ id }: { id: string }) {
  const { state, retry } = useMe();
  return (
    <div>
      <span data-testid={id}>{state.status === "ready" ? state.me.owner.displayName : state.status}</span>
      <button onClick={retry}>retry-{id}</button>
    </div>
  );
}

let meSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  invalidateMe();
});
afterEach(() => {
  cleanup();
  meSpy?.mockRestore();
  vi.useRealTimers();
});

describe("shared session store", () => {
  it("dedupes: five consumers make one request", async () => {
    meSpy = vi.spyOn(adapters.household, "me").mockResolvedValue(ME("Asha"));
    render(<>{[1, 2, 3, 4, 5].map((i) => <Probe key={i} id={`p${i}`} />)}</>);
    await act(async () => {});
    expect(meSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("p5")).toHaveTextContent("Asha");
  });

  it("serves the cache within 30 s, refetches silently after", async () => {
    meSpy = vi.spyOn(adapters.household, "me").mockResolvedValue(ME("Asha"));
    const { unmount } = render(<Probe id="a" />);
    await act(async () => {});
    unmount();
    render(<Probe id="b" />);
    await act(async () => {});
    expect(meSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("b")).toHaveTextContent("Asha");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + ME_TTL_MS + 1);
    cleanup();
    render(<Probe id="c" />);
    expect(screen.getByTestId("c")).toHaveTextContent("Asha"); // stale shown while revalidating
    await act(async () => {});
    expect(meSpy).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale response that arrives after a newer one", async () => {
    const resolvers: ((v: never) => void)[] = [];
    meSpy = vi.spyOn(adapters.household, "me").mockImplementation(() => new Promise((r) => resolvers.push(r as never)));
    render(<Probe id="a" />);
    await act(async () => {});
    await act(async () => { screen.getByText("retry-a").click(); });
    expect(resolvers).toHaveLength(2);
    await act(async () => resolvers[1]!(ME("Fresh")));
    await act(async () => resolvers[0]!(ME("Stale")));
    expect(screen.getByTestId("a")).toHaveTextContent("Fresh");
  });

  it("retry recovers from down", async () => {
    meSpy = vi.spyOn(adapters.household, "me").mockRejectedValueOnce(new Error("x")).mockResolvedValue(ME("Asha"));
    render(<Probe id="a" />);
    await act(async () => {});
    expect(screen.getByTestId("a")).toHaveTextContent("down");
    await act(async () => { screen.getByText("retry-a").click(); });
    expect(screen.getByTestId("a")).toHaveTextContent("Asha");
    expect(meSpy).toHaveBeenCalledTimes(2);
  });

  it("revalidates on focus at most every 30 s", async () => {
    meSpy = vi.spyOn(adapters.household, "me").mockResolvedValue(ME("Asha"));
    vi.useFakeTimers({ toFake: ["Date"] });
    render(<Probe id="a" />);
    await act(async () => {});
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(meSpy).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + ME_TTL_MS + 1);
    await act(async () => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("focus")); });
    expect(meSpy).toHaveBeenCalledTimes(2);
  });
});
