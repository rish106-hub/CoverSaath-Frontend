/** Six-box one-time code helpers. Pure, so they are easy to test. */
export const OTP_LENGTH = 6;

export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

/** Put typed or pasted text into the boxes starting at `at`. Returns the new boxes and where focus should go. */
export function applyOtpInput(boxes: string[], at: number, text: string): { boxes: string[]; focus: number } {
  const d = digitsOnly(text);
  const next = boxes.slice(0, OTP_LENGTH);
  while (next.length < OTP_LENGTH) next.push("");
  if (!d) return { boxes: next, focus: at };
  let i = at;
  for (const ch of d) {
    if (i >= OTP_LENGTH) break;
    next[i] = ch;
    i += 1;
  }
  return { boxes: next, focus: Math.min(i, OTP_LENGTH - 1) };
}

export function otpComplete(boxes: string[]): boolean {
  return boxes.length === OTP_LENGTH && boxes.every((b) => /^\d$/.test(b));
}
