import type { Adapters } from "./types";
import { mockAdapters } from "./mock";
import { backendAccess, backendHousehold } from "./backend";

// Active adapter set. Access and household talk to the real backend through the BFF unless
// NEXT_PUBLIC_ADAPTERS=mock (or under test). Everything else is mock until the backend has tables.
const useBackend = process.env.NEXT_PUBLIC_ADAPTERS !== "mock" && process.env.NODE_ENV !== "test";

export const adapters: Adapters = {
  ...mockAdapters,
  access: useBackend ? backendAccess : mockAdapters.access,
  household: useBackend ? backendHousehold : mockAdapters.household,
};

export * from "./types";
export * from "./schemas";
