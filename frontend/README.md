# Awakening Frontend

Next.js 15 (App Router) + TypeScript + Tailwind + wagmi v2.

The default `mock` profile provides deterministic BTC / USDC Markets, Borrow, Lend, and Portfolio states without an RPC node, contract deployment, or wallet. `api` connects to the local backend contract when it is available.

## Prerequisites

- Node 22+
- pnpm 9+

## Setup

1. Copy env template:
   ```bash
   cp .env.local.example .env.local
   ```
2. Keep `NEXT_PUBLIC_DATA_PROFILE=mock`, or use `api` with a running local backend.
3. Optionally set Anvil and Sepolia RPC URLs for injected-wallet connectivity. No contract address is supplied or inferred; live submission stays disabled until a complete deployment configuration exists.

## Development

```bash
pnpm install
pnpm dev
```

Serves on http://localhost:3000.

## Build

```bash
pnpm build
pnpm start
```

## Structure

```
src/
├── app/
│   ├── layout.tsx          Root layout + <Providers>
│   ├── page.tsx            Redirects to Markets
│   ├── providers.tsx       Wagmi + demo-wallet + react-query providers
│   ├── markets/            Market catalogue and filters
│   ├── borrow/[marketId]/  Quote and simulated preview
│   ├── lend/[marketId]/    Quote and simulated signing preview
│   └── portfolio/          Disconnected, empty, error, and populated dashboard states
└── lib/
    └── wagmi.ts            Chain + RPC + wallet config
```

## Safety

The UI never calls legacy `take()` or `repay()` contract paths. When addresses are absent (the default), it clearly labels workflows as preview/simulation and blocks live submission.
