"use client";

import { useEffect, useState } from "react";
import { PageTitle, Kicker } from "@/components/type";
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
  if (state.status === "down") return <BackendDown onRetry={retry} />;
  const first = state.status === "ready" ? state.me.owner.displayName.split(" ")[0] : null;
  return (
    <div>
      <Kicker>{today || " "}</Kicker>
      <PageTitle>{first ? `${hello}, ${first}.` : state.status === "signed-out" ? `${hello}.` : `${hello}.`}</PageTitle>
    </div>
  );
}
