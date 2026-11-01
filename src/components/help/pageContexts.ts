// W6: register these in src/agent/page-context.ts (copied from each board's __voice() data).
export type HelpPageContext = { page: string; reads: string; examples: [string, string, string] };

export const HELP_PAGE_CONTEXTS: Record<string, HelpPageContext> = {
  "/desk": { page: "Desk", reads: "5 open cases with insurers and TPAs", examples: ["What is happening with Papa’s claim?", "Escalate it", "What do I need to sign?"] },
  "/emergency": { page: "Emergency", reads: "hospitals near you and Father’s e-card", examples: ["Nearest cashless hospital", "Call the hospital ahead", "Tell Rohan we are going"] },
  "/assistant": { page: "Ask Knowvia", reads: "everything you have shared", examples: ["What can you do for me?", "Show my open cases", "Is Rohan on the top-up?"] },
  "/shortcuts": { page: "Shortcuts", reads: "the full key map", examples: ["Show me every shortcut", "Take me to Emergency", "Switch to dark"] },
  "/settings": { page: "Settings", reads: "your connected sources and preferences", examples: ["Connect my Gmail", "Turn on WhatsApp updates", "Switch to Hindi"] },
};
