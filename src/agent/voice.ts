import type { VoiceAdapter } from "@/adapters/types";
import { AdapterError } from "@/adapters/types";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
type RecCtor = new () => Rec;

const ctor = (): RecCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

let active: Rec | null = null;

/** Browser speech recognition (English, Hindi or both). listen() resolves when stop() is called or speech ends. */
export const webVoice: VoiceAdapter = {
  supported: () => !!ctor(),
  listen: () =>
    new Promise<string>((resolve, reject) => {
      const C = ctor();
      if (!C) return reject(new AdapterError("VOICE_UNSUPPORTED"));
      const r = new C();
      r.lang = "en-IN";
      r.interimResults = false;
      r.continuous = false;
      let text = "";
      r.onresult = (e) => { text = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" ").trim(); };
      r.onerror = (e) => { active = null; reject(new AdapterError(`VOICE_${e.error}`.toUpperCase())); };
      r.onend = () => { active = null; resolve(text); };
      active = r;
      r.start();
    }),
  stop: () => { active?.stop(); },
};
