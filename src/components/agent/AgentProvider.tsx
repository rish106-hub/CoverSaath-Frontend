"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { adapters, type AssistantReply } from "@/adapters";
import { holdReducer, initialHold, type Hold } from "@/agent/hold";
import { isEditable, PAGE_SHORTCUT_EVENT, SHORTCUTS, useShortcuts } from "@/lib/shortcuts";
import { useTheme } from "@/components/theme";

export type Anchor = "dock" | "strip";
export type Mode = "voice" | "text";

type Ctx = {
  hold: Hold;
  mode: Mode;
  anchor: Anchor;
  anchorRect: DOMRect | null;
  transcript: string;
  reply: AssistantReply | null;
  done: number;
  note: string;
  paletteOpen: boolean;
  helpOpen: boolean;
  open: (trigger: HTMLElement | null, opts?: { mode?: Mode; anchor?: Anchor }) => void;
  close: () => void;
  submit: (text: string) => void;
  setPaletteOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
};

const AgentContext = createContext<Ctx | null>(null);
export function useAgent(): Ctx {
  const c = useContext(AgentContext);
  if (!c) throw new Error("useAgent must be used inside AgentProvider");
  return c;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function AgentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/home";
  const router = useRouter();
  const { toggle } = useTheme();
  const [hold, dispatch] = useReducer(holdReducer, initialHold);
  const [mode, setMode] = useState<Mode>("voice");
  const [anchor, setAnchor] = useState<Anchor>("dock");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [done, setDone] = useState(0);
  const [note, setNote] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const holdRef = useRef(hold);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const run = useRef(0);
  const pathRef = useRef(pathname);
  useEffect(() => { holdRef.current = hold; pathRef.current = pathname; });

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => () => { run.current += 1; clearTimer(); }, []);

  const submit = useCallback((text: string) => {
    const said = text.trim();
    if (!said) return;
    const id = ++run.current;
    clearTimer();
    setTranscript(said);
    setReply(null);
    setDone(0);
    setNote("");
    dispatch({ type: "submit" });
    adapters.assistant.ask(said, pathRef.current).then((r) => {
      if (id !== run.current) return;
      setReply(r);
      if (reduced()) { setDone(3); dispatch({ type: "finish" }); return; }
      let n = 0;
      timer.current = setInterval(() => {
        n += 1;
        setDone(n);
        if (n >= 3) { clearTimer(); dispatch({ type: "finish" }); }
      }, 650);
    }).catch(() => {
      if (id !== run.current) return;
      setNote("That did not work. Try again.");
      dispatch({ type: "open" });
    });
  }, []);

  const listen = useCallback(() => {
    if (!adapters.voice.supported()) { setMode("text"); return; }
    setMode("voice");
    adapters.voice.listen().then((heard) => {
      if (heard) submit(heard);
      else { setMode("text"); setNote("I did not catch that. Type it instead."); }
    }).catch(() => { setMode("text"); setNote("Voice is not available here. Type it instead."); });
  }, [submit]);

  const open = useCallback((trigger: HTMLElement | null, opts: { mode?: Mode; anchor?: Anchor } = {}) => {
    triggerRef.current = trigger;
    setAnchor(opts.anchor ?? "dock");
    setAnchorRect(trigger?.getBoundingClientRect() ?? null);
    setTranscript(""); setReply(null); setDone(0); setNote("");
    dispatch({ type: "open" });
    if (opts.mode === "text") setMode("text"); else listen();
  }, [listen]);

  const close = useCallback(() => {
    run.current += 1;
    clearTimer();
    adapters.voice.stop?.();
    dispatch({ type: "escape" });
    setTranscript(""); setReply(null); setDone(0); setNote("");
    const t = triggerRef.current;
    if (t && t.isConnected) t.focus();
  }, []);

  // Pages ask the card to open with a phrase (e.g. the /assistant try-saying chips): window event "knowvia:ask".
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (!text) return;
      const active = document.activeElement as HTMLElement | null;
      open(active && active !== document.body ? active : document.querySelector<HTMLElement>("[data-ask-trigger]"), { mode: "text" });
      submit(text);
    };
    window.addEventListener("knowvia:ask", onAsk);
    return () => window.removeEventListener("knowvia:ask", onAsk);
  }, [open, submit]);

  // Hold V: keydown opens and listens, keyup submits. Ignored while an input is focused.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "v" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat || isEditable(e.target)) return;
      if (holdRef.current.held) return;
      const trigger = (document.activeElement as HTMLElement | null) ?? null;
      triggerRef.current = trigger && trigger !== document.body ? trigger : document.querySelector<HTMLElement>("[data-ask-trigger]");
      setAnchor("dock"); setAnchorRect(null);
      setTranscript(""); setReply(null); setDone(0); setNote("");
      dispatch({ type: "keydown", key: e.key });
      listen();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "v" || !holdRef.current.held) return;
      if (!adapters.voice.supported()) return; // text fallback: stay open and wait for typing
      dispatch({ type: "keyup", key: e.key });
      adapters.voice.stop?.();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [listen]);

  useEffect(() => () => clearTimer(), []);

  // Esc closes whichever layer is open (works even from inside the card's text field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (helpOpen) setHelpOpen(false);
      else if (paletteOpen) setPaletteOpen(false);
      else if (holdRef.current.open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, helpOpen, paletteOpen]);

  // Command palette: Cmd K / Ctrl K, from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useShortcuts(pathname, (id) => {
    if (paletteOpen) return;
    const s = SHORTCUTS.find((x) => x.id === id);
    if (!s) return;
    if (s.href) { router.push(s.href); return; }
    if (id === "theme") toggle();
    else if (id === "help") setHelpOpen((v) => !v);
    else if (id === "type") open(document.querySelector<HTMLElement>("[data-ask-trigger]"), { mode: "text" });
    else if (id === "close") return;
    else window.dispatchEvent(new CustomEvent(PAGE_SHORTCUT_EVENT, { detail: { id } }));
  });

  const value = useMemo<Ctx>(
    () => ({ hold, mode, anchor, anchorRect, transcript, reply, done, note, paletteOpen, helpOpen, open, close, submit, setPaletteOpen, setHelpOpen }),
    [hold, mode, anchor, anchorRect, transcript, reply, done, note, paletteOpen, helpOpen, open, close, submit],
  );
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
