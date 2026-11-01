/** Small artificial latency so loading states are exercised. Zero under test. */
export const delay = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), process.env.NODE_ENV === "test" ? 0 : ms));
