import type { Metadata } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, themeInitScript, CapabilityInit } from "@/components/theme";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/styles/globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", weight: ["400"], display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Knowvia", template: "%s · Knowvia" },
  description: "Your family's health cover, explained in rupees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-theme="light" className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <CapabilityInit />
        <SpeedInsights />
      </body>
    </html>
  );
}
