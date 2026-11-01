/** Deterministic 21x21 pattern that looks like a QR code and changes every 30 s window. Not a real code. */
export function qrCells(seed: string): boolean[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const N = 21;
  const inFinder = (x: number, y: number, ox: number, oy: number) =>
    x >= ox && x < ox + 7 && y >= oy && y < oy + 7 && (x === ox || x === ox + 6 || y === oy || y === oy + 6 || (x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4));
  const near = (x: number, y: number, ox: number, oy: number) => x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7;
  const out: boolean[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (near(x, y, 0, 0) || near(x, y, 14, 0) || near(x, y, 0, 14)) {
        out.push(inFinder(x, y, 0, 0) || inFinder(x, y, 14, 0) || inFinder(x, y, 0, 14));
        continue;
      }
      h = (h * 1103515245 + 12345) >>> 0;
      out.push(((h >> 16) & 1) === 1);
    }
  }
  return out;
}
