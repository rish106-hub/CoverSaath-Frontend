/**
 * Voice is on hold (owner decision, 2026-11-15): every mic, the voice intro and the hold-V shortcut stay off; typed Ask Knowvia stays on.
 * Set NEXT_PUBLIC_VOICE_ON_HOLD=false to bring voice back. Read on each call so tests can switch it.
 */
export const voiceOnHold = (): boolean => process.env.NEXT_PUBLIC_VOICE_ON_HOLD !== "false";
