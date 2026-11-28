// Shared measuring helpers of the real-account browser harness (moved unchanged out of real-screens.spec.ts, spec R5b.1). They live in their
// own file so every real-*.spec.ts can apply the same calm rules (scroll, font size, font weight, cut-off text) and none can loosen them alone.
import { expect, type Page } from "@playwright/test";

export const SHOTS = "test-results/real/";

export type Sink = string[];

type Rules = { fonts: boolean; scroll: boolean; cutOff: boolean };

/**
 * Measures one screen and reports every broken rule. Font rules: no visible element that directly holds text may be under 16px or under
 * weight 500. Scroll rules: the document and `main` must not scroll (text inside [data-panel="terms"] is skipped for these only, that
 * panel is hidden while they are measured). Cut-off rules, for text inside `main`: (1) the element's box must lie inside the box of every
 * ancestor up to `main` that hides its overflow (overflow hidden or clip), 1px tolerance; (2) an element that hides its own overflow must
 * not hold more content than it shows. A cut-off rule is measured with the terms panel as it is, never exempted. With a `sink` the broken
 * rules are collected under `label`; without one they fail the test at once.
 */
async function measure(page: Page, label: string, rules: Rules, sink?: Sink): Promise<void> {
  const found = await page.evaluate((on) => {
    const out: string[] = [];
    const small = new Map<string, string>();
    const thin = new Map<string, string>();
    const byContainer = new Map<string, string>();
    const bySelf = new Map<string, string>();
    const main = document.querySelector("main");
    const hides = (css: CSSStyleDeclaration) => ["hidden", "clip"].includes(css.overflowX) || ["hidden", "clip"].includes(css.overflowY);
    const round = (n: number) => Math.round(n * 10) / 10;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "").map((n) => (n.textContent ?? "").trim()).join(" ");
      if (!own) continue;
      const box = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      // An element is visible when it has a real box and is not hidden; 1px boxes are screen-reader-only text.
      if (box.width <= 1 || box.height <= 1 || css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0) continue;
      const fontSize = parseFloat(css.fontSize);
      const fontWeight = parseInt(css.fontWeight, 10);
      const tag = `<${el.tagName.toLowerCase()}> "${own.slice(0, 40)}"`;
      if (on.fonts && fontSize < 16) small.set(tag, `font size ${fontSize}px (under 16)`);
      if (on.fonts && fontWeight < 500) thin.set(tag, `font weight ${fontWeight} (under 500)`);
      if (on.cutOff && main && main.contains(el)) {
        // Per axis: an ancestor only cuts content off on an axis it clips (hidden or clip). Once an ancestor scrolls on an axis
        // (auto or scroll), content beyond it on that axis is reachable, so that axis is no longer checked further up.
        // A name deliberately shortened with an ellipsis (data-truncate plus a title holding the full text) is not a finding.
        const clips = (v: string) => v === "hidden" || v === "clip";
        const scrolls = (v: string) => v === "auto" || v === "scroll";
        const truncated = el.closest("[data-truncate][title]");
        let checkX = !truncated, checkY = !truncated;
        for (let up = el.parentElement; up && (checkX || checkY); up = up.parentElement) {
          const upCss = getComputedStyle(up);
          const ub = up.getBoundingClientRect();
          const outX = box.left < ub.left - 1 || box.right > ub.right + 1;
          const outY = box.top < ub.top - 1 || box.bottom > ub.bottom + 1;
          if ((checkX && clips(upCss.overflowX) && outX) || (checkY && clips(upCss.overflowY) && outY)) {
            byContainer.set(tag, `element box l${round(box.left)} t${round(box.top)} r${round(box.right)} b${round(box.bottom)} lies outside <${up.tagName.toLowerCase()}> box l${round(ub.left)} t${round(ub.top)} r${round(ub.right)} b${round(ub.bottom)} (overflow ${upCss.overflowX}/${upCss.overflowY})`);
            break;
          }
          if (scrolls(upCss.overflowX)) checkX = false;
          if (scrolls(upCss.overflowY)) checkY = false;
          if (up === main) break;
        }
        if (hides(css) && !(el.hasAttribute("data-truncate") && (el.getAttribute("title") ?? "").trim() === (el.textContent ?? "").trim())) {
          const h = el as HTMLElement;
          if (h.scrollHeight > h.clientHeight + 1 || h.scrollWidth > h.clientWidth + 1) {
            bySelf.set(tag, `scrollHeight ${h.scrollHeight} vs clientHeight ${h.clientHeight}, scrollWidth ${h.scrollWidth} vs clientWidth ${h.clientWidth} (overflow ${css.overflowX}/${css.overflowY})`);
          }
        }
      }
    }
    for (const [tag, why] of byContainer) out.push(`not cut off by a container: ${tag}: ${why}`);
    for (const [tag, why] of bySelf) out.push(`not cut off by itself: ${tag}: ${why}`);
    for (const [tag, why] of small) out.push(`${tag}: ${why}`);
    for (const [tag, why] of thin) out.push(`${tag}: ${why}`);
    if (on.scroll) {
      const terms = Array.from(document.querySelectorAll<HTMLElement>('[data-panel="terms"]'));
      const shown = terms.map((t) => t.style.display);
      terms.forEach((t) => { t.style.display = "none"; });
      const doc = document.documentElement;
      if (doc.scrollHeight > window.innerHeight + 1) out.push(`scroll: document scrollHeight ${doc.scrollHeight} > innerHeight ${window.innerHeight} + 1`);
      if (main && main.scrollHeight > main.clientHeight + 1) out.push(`scroll: main scrollHeight ${main.scrollHeight} > clientHeight ${main.clientHeight} + 1`);
      terms.forEach((t, i) => { t.style.display = shown[i] ?? ""; });
    }
    return out;
  }, rules);
  const viewport = page.viewportSize();
  const tagged = found.map((f) => `${label} @ ${viewport?.width}x${viewport?.height}: ${f}`);
  if (sink) sink.push(...tagged);
  else expectNoFindings(tagged, "calm rules (cut off, font size, font weight, scroll)");
}

/** Fails with one finding per line (screen, size, rule, element text, numbers) instead of a diff, so a report can be copied from the output. */
export function expectNoFindings(found: Sink, what: string): void {
  expect(found.length, `${what}: ${found.length} finding(s)\n${found.map((f) => `finding: ${f}`).join("\n")}`).toBe(0);
}

/** Every rule: scroll, font size, font weight and both cut-off rules. */
export const expectCalm = (page: Page, label: string, sink?: Sink): Promise<void> => measure(page, label, { fonts: true, scroll: true, cutOff: true }, sink);

/** For screens that may scroll (short laptops): the two cut-off rules and the two font rules, no scroll rules. */
export const expectNothingCutOff = (page: Page, label: string, sink?: Sink): Promise<void> => measure(page, label, { fonts: true, scroll: false, cutOff: true }, sink);

export const shot = async (page: Page, screen: string): Promise<void> => {
  const size = page.viewportSize();
  await page.screenshot({ path: `${SHOTS}${screen}-${size?.width}x${size?.height}.png`, animations: "disabled" });
};

export const SIZES = [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1366, height: 650 }] as const;
