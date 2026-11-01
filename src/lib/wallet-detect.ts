import type { WalletPlatform } from "@/adapters/schemas";

/** Which wallet to show first for a user agent. Samsung first (Galaxy UAs also say Android), then Apple, then Google. */
export function detectWalletPlatform(ua: string): WalletPlatform {
  if (/SamsungBrowser|SM-[A-Z0-9]+|Galaxy/i.test(ua)) return "samsung";
  if (/iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua)) return "apple";
  return "google";
}

export const WALLET_ORDER: WalletPlatform[] = ["apple", "google", "samsung"];

/** Detected wallet first, the others after it. */
export function orderWallets(first: WalletPlatform): { first: WalletPlatform; others: WalletPlatform[] } {
  return { first, others: WALLET_ORDER.filter((p) => p !== first) };
}
