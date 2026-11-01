"use client";

import { useCallback, useEffect, useState } from "react";
import { adapters, type Me } from "@/adapters";

export type MeState = { status: "loading" } | { status: "ready"; me: Me } | { status: "signed-out" } | { status: "down" };

/** Reads the signed-in person via the household adapter (backend when configured). */
export function useMe(): { state: MeState; retry: () => void } {
  const [state, setState] = useState<MeState>({ status: "loading" });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    adapters.household
      .me()
      .then((me) => live && setState(me ? { status: "ready", me } : { status: "signed-out" }))
      .catch(() => live && setState({ status: "down" }));
    return () => {
      live = false;
    };
  }, [n]);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setN((v) => v + 1);
  }, []);
  return { state, retry };
}
