# Awakening Frontend

Next.js 15 (App Router) + TypeScript + Tailwind + wagmi v2 + RainbowKit.

See `../Awakening Implementation Plan.md` §Phase 3 for the milestone plan.
This scaffold delivers Milestone 3A (setup) + empty page shells for
Milestones 3B / 3C / 3D / 3E. No live data yet.

## Prerequisites

- Node 22+
- pnpm 9+

## Setup

1. Copy env template:
   ```bash
   cp .env.local.example .env.local
   ```
2. Fill in `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — get one at
   https://cloud.walletconnect.com. Without this, wallet connect UI will
   render but connections will fail.
3. Optionally set `NEXT_PUBLIC_SEPOLIA_RPC_URL` (defaults to `https://sepolia.drpc.org`).

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
│   ├── page.tsx            Landing page with ConnectButton
│   ├── providers.tsx       Wagmi + RainbowKit + react-query providers
│   ├── markets/            Milestone 3B
│   ├── borrow/[marketId]/  Milestone 3C
│   ├── lend/[marketId]/    Milestone 3D
│   └── portfolio/          Milestone 3E
└── lib/
    └── wagmi.ts            Chain + RPC + wallet config
```

## Deployment

Vercel (per Appendix B decision). Set the three
`NEXT_PUBLIC_*` env vars in the Vercel project.
