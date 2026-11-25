"use client";

import { useEffect, useState } from "react";
import { PageTitle, Kicker } from "@/components/type";
import { ShimmerBlock } from "@/components/ui/Skeleton";
import { BackendDown } from "./BackendDown";
import { useMe } from "./useMe";

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Home title block: greeting and name read back from the backend. */
export function HomeGreeting() {
  const { state, retry } = useMe();
  const [hello, setHello] = useState("Good evening");
  const [today, setToday] = useState("");
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHello(greeting(d.getHours()));
    setToday(d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }));
  }, []);
  // The part of day is only known after mount (server and browser clocks differ). Showing "Good evening" first and
  // swapping it would change the heading after first paint, so the skeleton holds until both the clock and the name are known.
  const settled = today !== "";
  const first = state.status === "ready" ? state.me.owner.displayName.split(" ")[0] : null;
  return (
    <div className="k-no-fade">
      <Kicker>{today || " "}</Kicker>
      {/* While loading, no greeting text at all: the name-less greeting would be swapped for the named one a moment later. */}
      <PageTitle>
        {state.status === "loading" || !settled ? (
          <>
            <span className="sr-only">{"Loading"}</span>
            <ShimmerBlock style={{ height: 48, maxWidth: 420 }} />
          </>
        ) : state.status === "ready" ? `${hello}, ${first}.` : `${hello}.`}
      </PageTitle>
      {/* The h1 stays when the backend is down so the page keeps its heading; the notice sits below it as an h2. */}
      {state.status === "down" ? <BackendDown onRetry={retry} /> : null}
    </div>
  );
}
