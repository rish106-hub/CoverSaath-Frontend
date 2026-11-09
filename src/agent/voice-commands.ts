import { pageFor } from "@/lib/ia";

/** Three spoken commands per page, shown before the person says anything. Each one runs through the same path as speech. */
export const VOICE_COMMANDS: Record<string, [string, string, string]> = {
  "/home": ["Open my family", "Is Mumma’s cataract covered?", "Show my open cases"],
  "/policies": ["Which policy covers Mumma?", "Open compare", "Add another policy"],
  "/policies/[id]": ["Explain this page in simple words", "Where does it say maternity?", "Open compare"],
  "/stress-test": ["What if Papa needs a bypass?", "Open tools", "Open my family"],
  "/compare": ["Which plan is best for my parents?", "Make no co-pay my top priority", "Open stress test"],
  "/review": ["Accept everything you recommend", "Open home", "Open money desk"],
  "/family": ["Add my father", "Show who is covered", "Open money desk"],
  "/cards": ["Share Mumma’s card with Rohan", "Open my family", "Open emergency"],
  "/money": ["How much can I claim under 80D?", "Where is my refund?", "Open tools"],
  "/tools": ["Find a top-up for my parents", "Open stress test", "Open compare"],
  "/desk": ["What is happening with Papa’s claim?", "Open emergency", "Open my family"],
  "/emergency": ["Nearest cashless hospital", "Open cards", "Open my family"],
  "/assistant": ["What can you do for me?", "Open my money", "Show my open cases"],
  "/shortcuts": ["How do I talk to you?", "Open settings", "Open home"],
  "/settings": ["What have I connected?", "Open profile", "Open home"],
  "/profile": ["Why do you need my location?", "Open settings", "Open home"],
  "/upload": ["Add my health policy", "Open my policies", "Open home"],
  "/welcome": ["I can’t find my policy", "My employer gives me insurance", "Open home"],
};
const FALLBACK: [string, string, string] = ["Open my family", "Open money desk", "What can you do for me?"];

export function commandsFor(pathname: string): [string, string, string] {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean.startsWith("/welcome")) return VOICE_COMMANDS["/welcome"];
  const route = pageFor(clean)?.route ?? clean;
  return VOICE_COMMANDS[route] ?? FALLBACK;
}
