# Awakening Frontend

## Current BNB testnet application

Use [the unified workspace startup guide](../docs/local-bsc-testnet.md) for the current application, real wallet interactions, and BNB testnet deployment. The frontend runs from this directory; no separate Git worktree is required. The current environment template selects `api` and the local backend on port 8082. Routes include `/faucet` as well as Markets, Orders, Positions, and Settlement.

The notes below describe the original mock/preview workflow, not the current testnet deployment or wallet UI. For current architecture and transaction safeguards, see [architecture overview](../docs/architecture-overview.md).

## Original preview workflow (historical reference)

Next.js 15 (App Router) + TypeScript + Tailwind + wagmi v2.

The default `mock` profile provides deterministic Markets, Orders, Positions, Settlement, Borrow and Lend states without an RPC node or deployment. `api` connects to the local Spring backend.

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

Core routes: `/markets`, `/orders`, `/positions`, and `/settlement`. Choose **Use demo wallet** for `0xde00000000000000000000000000000000000001`. Order and settlement mutations are preview-only and send no signature or transaction.

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
│   ├── markets/            Market catalogue and take/order actions
│   ├── orders/             Borrow/Lend order management
│   ├── positions/          Credit, debt, collateral and PAT
│   ├── settlement/         Preview maturity actions
│   ├── borrow/[marketId]/  Quote and simulated preview
│   ├── lend/[marketId]/    Quote and simulated signing preview
│   └── portfolio/          Compatibility redirect to Positions
└── lib/
    ├── api/                 Typed API, parsing and mock parity
    └── contracts/           Chain + wallet configuration
```

## Safety

The UI never calls legacy `take()` or `repay()` contract paths. When addresses are absent (the default), it clearly labels workflows as preview/simulation and blocks live submission.

## Live testnet builds

Set `NEXT_PUBLIC_DATA_PROFILE=api` and select `NEXT_PUBLIC_TESTNET=arbitrum-sepolia`
or `robinhood-testnet`. The build reads the selected real deployment and faucet
manifests from `contracts/deployments/` and rejects a missing deployment.
Arbitrum uses `/arbitrum` as its public API base; Robinhood uses `/robinhood`
and serves pages under `/robinhood`. BNB is retained for compatibility and hidden
from the public network selector. Deploy each network as a separate frontend and
backend process. Test assets have no monetary value; PAT protection is simulated.

Local on-chain acceptance receipts for both networks are recorded in
`contracts/deployments/*-local-acceptance.json`. See `ops/gcp/README.md` for the
exact-commit dual-chain release and rollback procedure.
