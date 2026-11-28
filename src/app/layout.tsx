import type { Metadata } from "next";
import { Newsreader, Geist, Geist_Mono, Source_Sans_3 } from "next/font/google";
import { ThemeProvider, themeInitScript, CapabilityInit } from "@/components/theme";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { MotionRoot } from "@/components/ui/MotionRoot";
import "@/styles/globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", weight: ["400", "500", "600"], display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Knowvia", template: "%s · Knowvia" },
  description: "Your family's health cover, explained in rupees.",
};

// Cloudflare Web Analytics token: public by design, ships in the page. Cookieless.
const CF_BEACON = JSON.stringify({ token: "4ca4716292c644ef8ca736a08800b726" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="light" className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} ${sourceSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider><MotionRoot>{children}</MotionRoot></ThemeProvider>
        <CapabilityInit />
        <SpeedInsights />
        <Analytics />
        {process.env.NODE_ENV === "production" && (
          <script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={CF_BEACON} />
        )}
      </body>
    </html>
  );
}
