"use client";

// Fit rule hook (spec R5b.7). Exists so a list or a panel shows only as many rows as its box can hold at the person's laptop height,
// instead of a fixed count that gets cut off on a short screen. Measured in the browser; a test environment without layout gets the maximum.
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * How many units of `unit` px fit in the element's height, kept between `min` and `max`.
 * Before the first measure, when the element is not on the page or hidden (height 0, as under jsdom) and when ResizeObserver
 * is missing, the answer is `max`: the layout then shows everything it can and the scroll or page-size rules still apply.
 */
export function useFit(ref: RefObject<HTMLElement | null>, unit: number, min: number, max: number): number {
  const [height, setHeight] = useState(0);
  const observed = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  // After every render: the element can appear later than the first render (a grid that only renders once the policies are loaded),
  // so the observer follows whichever element the ref holds now. State is set only from the observer callback, never from the effect body.
  useEffect(() => {
    const element = ref.current;
    if (element === observed.current) return;
    observer.current?.disconnect();
    observed.current = element;
    if (!element || typeof ResizeObserver === "undefined") return;
    observer.current ??= new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setHeight(Math.round(last.target.getBoundingClientRect().height));
    });
    observer.current.observe(element);
  });

  // Unmount (and the development double-mount) forgets the element too, so the effect above observes it again instead of assuming it still is.
  useEffect(() => () => {
    observer.current?.disconnect();
    observer.current = null;
    observed.current = null;
  }, []);

  if (height <= 0) return max;
  return Math.min(max, Math.max(min, Math.floor(height / unit)));
}
