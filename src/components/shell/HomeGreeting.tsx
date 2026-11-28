"use client";

import { useEffect, useState } from "react";
import { PageTitle } from "@/components/type";
import { ShimmerBlock } from "@/components/ui/Skeleton";
import styles from "./HomeGreeting.module.css";
import { BackendDown } from "./BackendDown";
import { useMe } from "./useMe";

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Home title block: greeting and name read back from the backend. The "line" size is the same text as a 22px line, for the real Home that puts the cover sentence below it. */
export function HomeGreeting({ size = "page" }: { size?: "page" | "line" }) {
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
  const greetingText = state.status === "loading" || !settled ? (
    <>
      <span className="sr-only">{"Loading"}</span>
      <ShimmerBlock style={{ height: size === "line" ? 28 : 48, maxWidth: 420 }} />
    </>
  ) : state.status === "ready" ? `${hello}, ${first}.` : `${hello}.`;
  return (
    <div className="k-no-fade">
      {/* While loading, no greeting text at all: the name-less greeting would be swapped for the named one a moment later. */}
      {size === "line" ? <h1 className={styles.line}>{greetingText}</h1> : <PageTitle>{greetingText}</PageTitle>}
      {/* The h1 stays when the backend is down so the page keeps its heading; the notice sits below it as an h2. */}
      {state.status === "down" ? <BackendDown onRetry={retry} /> : null}
    </div>
  );
}
