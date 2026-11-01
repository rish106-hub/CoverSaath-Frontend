/** Hold-V state machine: keydown listens, keyup submits, Esc closes. Pure reducer so it can be tested. */
export type HoldState = "idle" | "listening" | "working" | "done";
export type HoldEvent =
  | { type: "keydown"; key: string; repeat?: boolean; inInput?: boolean }
  | { type: "keyup"; key: string }
  | { type: "open" }
  | { type: "submit" }
  | { type: "finish" }
  | { type: "show" }
  | { type: "rest" }
  | { type: "escape" };

export type Hold = { state: HoldState; open: boolean; held: boolean };
export const initialHold: Hold = { state: "idle", open: false, held: false };

export function holdReducer(h: Hold, e: HoldEvent): Hold {
  switch (e.type) {
    case "keydown":
      if (e.key.toLowerCase() !== "v" || e.repeat || e.inInput) return h;
      return { state: "listening", open: true, held: true };
    case "keyup":
      if (e.key.toLowerCase() !== "v" || !h.held) return h;
      return h.state === "listening" ? { state: "working", open: true, held: false } : { ...h, held: false };
    case "open":
      return { state: "listening", open: true, held: false };
    case "submit":
      return h.open ? { state: "working", open: true, held: false } : h;
    case "finish":
      return h.state === "working" ? { ...h, state: "done" } : h;
    case "show":
      return h.open ? h : { state: "idle", open: true, held: false };
    case "rest":
      return h.open ? { state: "idle", open: true, held: false } : h;
    case "escape":
      return initialHold;
  }
}

export const STATE_LABEL: Record<HoldState, string> = {
  idle: "",
  listening: "LISTENING…",
  working: "WORKING ON IT",
  done: "DONE · SAY THE NEXT THING",
};
