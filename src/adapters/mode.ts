/** True when the app talks to the backend through the BFF; false for the in-memory mock (NEXT_PUBLIC_ADAPTERS=mock, and under test). */
export const useBackend = process.env.NEXT_PUBLIC_ADAPTERS !== "mock" && process.env.NODE_ENV !== "test";
