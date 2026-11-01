import "@testing-library/jest-dom/vitest";

// Pin device capability so tests do not depend on the machine running them (low-core CI would switch animations off).
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "hardwareConcurrency", { value: 8, configurable: true });
}
