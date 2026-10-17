import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import '@/components/chain/account-workspace.css';
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/app-shell";

const directionContract = `AWAKENING DIRECTION CONTRACT — seed ff920e19
THESIS: fixed-maturity BTC credit is understood through protected settlement, not dashboard decoration.
OWN-WORLD: near-black cosmic ground; precise violet and lavender; data-led market and transaction surfaces.
STORY: compare a market, understand PAT coverage, preview every step, then inspect positions without mistaking preview data for production.
FIRST VIEWPORT: sticky protocol header, honest preview status, invariant, API-derived overview, and a dense market table.
FORM: operate-first composition with semantic tables, market facts beside transaction tickets, exact decimals, visible states, responsive 44px controls.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`;

const localSansFallback = localFont({
  src: "./fonts/geist-latin-fallback.woff2",
  variable: "--font-local-sans",
  weight: "100 900",
  display: "swap",
});

const localMonoFallback = localFont({
  src: "./fonts/geist-mono-latin-fallback.woff2",
  variable: "--font-local-mono",
  weight: "100 900",
  display: "swap",
});

const directionContractScript = `document.body.insertBefore(document.createComment(${JSON.stringify(
  directionContract,
)}), document.body.firstChild);`;

export const metadata: Metadata = {
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }], shortcut: '/icon.svg' },
  title: "Awakening — fixed-maturity protected credit",
  description: "Fixed-rate credit against BTC and tokenized securities with deterministic preview markets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${localSansFallback.variable} ${localMonoFallback.variable}`}
      >
        <script
          data-direction-contract="ff920e19"
          dangerouslySetInnerHTML={{ __html: directionContractScript }}
        />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
