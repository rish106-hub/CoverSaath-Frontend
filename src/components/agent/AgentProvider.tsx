"use client";

import { prefersReducedMotion } from "@/lib/use-reduced-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { adapters, type AssistantReply } from "@/adapters";
import { resolveNavigation } from "@/agent/navigate";
import { holdReducer, initialHold, type Hold } from "@/agent/hold";
import { isEditable, PAGE_SHORTCUT_EVENT, SHORTCUTS, useShortcuts } from "@/lib/shortcuts";
import { useTheme } from "@/components/theme";

export type Anchor = "dock" | "strip";
export type Mode = "voice" | "text";
/** One panel, three states: closed, voice (primary) and chat (the same panel expanded upward). */
export type View = "closed" | "voice" | "chat";
export type ChatMessage = { id: number; role: "user" | "assistant"; text: string; route?: string; goLabel?: string };

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
  view: View;
  /** Shared conversation for voice and chat. Kept while the panel is closed. */
  chatOpen: boolean;
  thread: ChatMessage[];
  thinking: boolean;
  speaking: boolean;
  /** Expand to chat (true), fold back to voice (false), or flip when omitted. */
  setChat: (on?: boolean) => void;
  closeChat: () => void;
  /** Tap the mic: start listening, or stop and send what was heard. */
  toggleMic: () => void;
  dictate: () => void;
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

const reduced = prefersReducedMotion;

export function AgentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/home";
  const router = useRouter();
  const { toggle } = useTheme();
  const [hold, dispatch] = useReducer(holdReducer, initialHold);
  const [view, setViewState] = useState<View>("closed");
  const [anchor, setAnchor] = useState<Anchor>("dock");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [done, setDone] = useState(0);
  const [note, setNote] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const viewRef = useRef<View>("closed");
  const msgId = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const holdRef = useRef(hold);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const run = useRef(0);
  const pathRef = useRef(pathname);
  const spokenRef = useRef(false);
  useEffect(() => { holdRef.current = hold; pathRef.current = pathname; });

  const mode: Mode = view === "chat" ? "text" : "voice";
  const chatOpen = view === "chat";
  const setView = useCallback((v: View) => { viewRef.current = v; setViewState(v); }, []);

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const stopSpeech = () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel?.();
    setSpeaking(false);
  };
  useEffect(() => () => { run.current += 1; clearTimer(); }, []);

  const speak = useCallback((text: string) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.onend = () => { if (alive.current) setSpeaking(false); };
    u.onerror = u.onend;
    setSpeaking(true);
    synth.speak(u);
  }, []);

  /** One path for typed and spoken questions: the thread keeps both, the voice view also ticks its steps. */
  const submit = useCallback((text: string) => {
    const said = text.trim();
    if (!said) return;
    const id = ++run.current;
    clearTimer();
    stopSpeech();
    const fromVoice = spokenRef.current;
    spokenRef.current = false;
    setThread((t) => [...t, { id: ++msgId.current, role: "user", text: said }]);
    setTranscript(said);
    setReply(null);
    setDone(0);
    setNote("");
    setThinking(true);
    dispatch({ type: "show" });
    dispatch({ type: "submit" });
    const nav = resolveNavigation(said);
    if (nav) {
      const line = `Opening ${nav.label}`;
      const r: AssistantReply = { reply: line, steps: ["Navigate", "Found the page", line], pageRef: nav.label };
      setThread((t) => [...t, { id: ++msgId.current, role: "assistant", text: line }]);
      setReply(r);
      setThinking(false);
      setDone(3);
      dispatch({ type: "finish" });
      if (fromVoice) speak(line);
      router.push(nav.href);
      return;
    }
    adapters.assistant.ask(said, pathRef.current).then((r) => {
      if (id !== run.current || !alive.current) return;
      setThread((t) => [...t, { id: ++msgId.current, role: "assistant", text: r.reply, route: r.route, goLabel: r.goLabel }]);
      setReply(r);
      setThinking(false);
      if (fromVoice) speak(r.reply);
      if (reduced() || viewRef.current === "chat") { setDone(3); dispatch({ type: "finish" }); return; }
      let n = 0;
      timer.current = setInterval(() => {
        n += 1;
        setDone(n);
        if (n >= 3) { clearTimer(); dispatch({ type: "finish" }); }
      }, 650);
    }).catch(() => {
      if (id !== run.current || !alive.current) return;
      setThinking(false);
      setThread((t) => [...t, { id: ++msgId.current, role: "assistant", text: "That did not work. Try again." }]);
      setNote("That did not work. Try again.");
      dispatch({ type: "rest" });
    });
  }, [speak, router]);

  const listen = useCallback((held = false) => {
    if (!adapters.voice.supported()) {
      setView("chat");
      setNote("Voice is not available here. Type your question.");
      dispatch({ type: "rest" });
      return;
    }
    stopSpeech();
    setNote("");
    dispatch({ type: "show" });
    if (!held) dispatch({ type: "open" });
    adapters.voice.listen().then((heard) => {
      if (!alive.current) return;
      if (heard) { spokenRef.current = true; submit(heard); }
      else { setNote("I did not catch that. Tap the mic and try again."); dispatch({ type: "rest" }); }
    }).catch(() => {
      if (!alive.current) return;
      setNote("Voice is not available here. Type your question.");
      setView("chat");
      dispatch({ type: "rest" });
    });
  }, [submit, setView]);

  const open = useCallback((trigger: HTMLElement | null, opts: { mode?: Mode; anchor?: Anchor } = {}) => {
    triggerRef.current = trigger;
    setAnchor(opts.anchor ?? "dock");
    setAnchorRect(trigger?.getBoundingClientRect() ?? null);
    dispatch({ type: "show" });
    if (opts.mode === "text") { setView("chat"); return; }
    if (viewRef.current === "closed") { setTranscript(""); setReply(null); setDone(0); setNote(""); }
    setView("voice");
    listen();
  }, [listen, setView]);

  const setChat = useCallback((on?: boolean) => {
    const next = on ?? viewRef.current !== "chat";
    if (viewRef.current === "closed") return;
    if (next && viewRef.current !== "chat") {
      clearTimer();
      if (holdRef.current.state === "working") { setDone(3); dispatch({ type: "finish" }); }
    }
    setView(next ? "chat" : "voice");
  }, [setView]);

  const close = useCallback(() => {
    run.current += 1;
    clearTimer();
    stopSpeech();
    adapters.voice.stop?.();
    dispatch({ type: "escape" });
    setView("closed");
    setThinking(false);
    setTranscript(""); setReply(null); setDone(0); setNote("");
    const t = triggerRef.current;
    if (t && t.isConnected) t.focus();
  }, [setView]);

  const closeChat = useCallback(() => setChat(false), [setChat]);

  const toggleMic = useCallback(() => {
    if (holdRef.current.state === "listening") { adapters.voice.stop?.(); return; }
    listen();
  }, [listen]);

  // Voice dictation from the chat view: same path as the mic.
  const dictate = toggleMic;

  // Pages ask the panel to open with a phrase (e.g. the /assistant try-saying chips): window event "knowvia:ask".
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
      if (!adapters.voice.supported() && viewRef.current === "closed") {
        open(document.querySelector<HTMLElement>("[data-ask-trigger]"), { mode: "text" });
        return;
      }
      if (viewRef.current === "closed") {
        const trigger = (document.activeElement as HTMLElement | null) ?? null;
        triggerRef.current = trigger && trigger !== document.body ? trigger : document.querySelector<HTMLElement>("[data-ask-trigger]");
        setAnchor("dock"); setAnchorRect(null);
        setTranscript(""); setReply(null); setDone(0); setNote("");
        setView("voice");
      }
      dispatch({ type: "keydown", key: e.key });
      listen(true);
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
  }, [listen, open, setView]);

  // Esc folds the chat back to voice; a second Esc closes. Works from inside the input too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (helpOpen) setHelpOpen(false);
      else if (paletteOpen) setPaletteOpen(false);
      else if (viewRef.current === "chat") setChat(false);
      else if (viewRef.current === "voice") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, setChat, helpOpen, paletteOpen]);

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
    () => ({ hold, mode, view, anchor, anchorRect, transcript, reply, done, note, paletteOpen, helpOpen, chatOpen, thread, thinking, speaking, setChat, closeChat, toggleMic, dictate, open, close, submit, setPaletteOpen, setHelpOpen }),
    [hold, mode, view, anchor, anchorRect, transcript, reply, done, note, paletteOpen, helpOpen, chatOpen, thread, thinking, speaking, setChat, closeChat, toggleMic, dictate, open, close, submit],
  );
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
