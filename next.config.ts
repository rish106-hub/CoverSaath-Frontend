import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Dev only. Next blocks the HMR websocket and /_next/* dev resources from any
   * origin it does not recognise. A tab opened from another origin (127.0.0.1,
   * or the Mac's LAN address from a phone) then fails to hold the HMR socket, and the
   * client falls back to full-page reloads, which looks like a reload loop. Listing
   * the origins keeps HMR on its websocket. Hostnames only, no ports. No effect on
   * `next build` / `next start`.
   */
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
};

export default config;
