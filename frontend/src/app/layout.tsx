import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/app-shell";

/*
 * Design direction audit — seed ff920e19
 * User-fixed direction: awakening-mvp faithful evolution.
 * Preserve the reference's cosmic black ground, precise violet/lavender hierarchy,
 * dense operating surfaces, PAT/status language, and explicit preview-state honesty.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Awakening — fixed-maturity BTC credit",
  description: "Fixed-rate BTC credit with deterministic local and testnet-ready profiles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
