import type { DocumentAdapter } from "./types";
import { AdapterError } from "./types";
import { backendUploads } from "./uploads";

const KIND_NAME: Record<string, string> = { policy_wording: "Policy wording", policy_schedule: "Policy schedule", endorsement: "Endorsement" };

/** Real accounts: the stored documents, by kind and upload date. Adding one goes through the upload flow, not this adapter. */
export const realDocuments: DocumentAdapter = {
  async list() {
    const { documents } = await backendUploads.list();
    return documents
      .filter((d) => d.note !== "DELETING" && d.note !== "REJECTED")
      .map((d) => {
        const day = d.uploadedAt ? d.uploadedAt.slice(0, 10) : "";
        return { id: d.id, name: `${KIND_NAME[d.kind] ?? "Document"}${day ? ` · ${day}` : ""}`, status: d.steps.reading === "done" ? ("read" as const) : d.steps.reading === "active" ? ("reading" as const) : ("received" as const) };
      });
  },
  add: async () => {
    throw new AdapterError("NOT_AVAILABLE");
  },
};
