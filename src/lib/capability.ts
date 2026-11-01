/** Device capability, read once. SSR-safe: on the server nothing is known, so nothing counts as low. */
export type Capability = { memoryGb: number | null; cores: number | null; saveData: boolean; reducedMotion: boolean };

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/** Hardware facts never change in a visit, so they are read once. Reduced motion can change, so it is read live. */
let cached: Omit<Capability, "reducedMotion"> | null = null;

export function readCapability(): Capability {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { memoryGb: null, cores: null, saveData: false, reducedMotion: false };
  }
  const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (cached) return { ...cached, reducedMotion };
  const n = navigator as Nav;
  cached = {
    memoryGb: typeof n.deviceMemory === "number" ? n.deviceMemory : null,
    cores: typeof n.hardwareConcurrency === "number" && n.hardwareConcurrency > 0 ? n.hardwareConcurrency : null,
    saveData: n.connection?.saveData === true,
  };
  return { ...cached, reducedMotion };
}

/** Forget the cached read (tests). */
export function resetCapability() {
  cached = null;
}

/** Low memory (<= 4 GB), few cores (<= 4), data saver, or a reduced-motion request: all mean "keep it light". */
export function isLowCapacity(c: Capability = readCapability()): boolean {
  return (c.memoryGb !== null && c.memoryGb <= 4) || (c.cores !== null && c.cores <= 4) || c.saveData || c.reducedMotion;
}
