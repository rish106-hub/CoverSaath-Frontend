import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy. The app is same-origin only: the browser never calls
 * the backend (the BFF does, server-side), fonts are self-hosted by next/font,
 * and Vercel Speed Insights posts to a same-origin /_vercel path.
 * 'unsafe-inline' scripts are needed for the theme-init script and Next's inline
 * bootstrap; a nonce-based policy would force every page to render dynamically.
 * 'unsafe-eval' and ws: are dev only (React refresh, HMR).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), geolocation=(self), camera=(), payment=(), usb=(), bluetooth=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
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
