import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

// Next injects inline bootstrap scripts, so script-src needs 'unsafe-inline'
// until a nonce-based CSP is added. Fonts are self-hosted by next/font.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
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
