'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const NAV = [
  { href: '/markets', label: 'Markets', desc: 'Browse open Awakening markets by maturity and strike.' },
  { href: '/portfolio', label: 'Portfolio', desc: 'Your open borrow and lend positions.' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Awakening</h1>
        <ConnectButton />
      </header>
      <p className="mt-6 max-w-2xl text-sm text-neutral-500">
        Non-liquidative, fixed-rate, fixed-maturity BTC credit on Ethereum. Every loan is backed by a
        put option — no interim liquidations, ever.
      </p>
      <nav className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-neutral-200 p-5 transition hover:border-neutral-400"
          >
            <div className="font-medium">{item.label}</div>
            <div className="mt-1 text-sm text-neutral-500">{item.desc}</div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
