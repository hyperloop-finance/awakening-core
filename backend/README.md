# Awakening Backend

## Current BNB testnet application

Use [the unified workspace startup guide](../LOCAL-BSC-TESTNET.md) for the `bsc-testnet` profile, PostgreSQL setup, and local API on port 8082. The backend runs from this directory; no separate Git worktree is required. This profile indexes real BNB testnet contract state and persists signed orders; it is distinct from the original in-memory preview API below.

See [ARCHITECTURE-OVERVIEW.md](../ARCHITECTURE-OVERVIEW.md) for the current API, wallet, and contract boundaries.

## Original preview workflow (historical reference)

Java 21 + Spring Boot 3 preview API for the Awakening hackathon product loop.

## Prerequisites

- Java 21 LTS
No global Maven install required — the `./mvnw` wrapper is included.

## Local development

1. Build + run tests:
   ```bash
   ./mvnw verify
   ```

2. Run the app:
   ```bash
   ./mvnw spring-boot:run
   ```
   Serves on `http://localhost:8080`. Actuator health at `/actuator/health`.

## Configuration

The shared demo wallet is `0xde00000000000000000000000000000000000001`. Orders and settlement progress are stored in memory and reset on restart. Settlement actions are simulations; no chain transaction is created.

User endpoints: `/api/v1/markets`, `/api/v1/orders`, `/api/v1/positions/{wallet}`, and `/api/v1/settlements/{wallet}`. `/api/v1/portfolio/{wallet}` remains a compatibility endpoint.

The mock/test market catalog is deterministic and contains `BTC/USDC`,
`QQQB/USDC`, `SPCXB/USDT`, `NVDAB/USDC`, and `BNCB/USDT`. These are
preview fixtures, not live Binance prices or deployed on-chain markets. Quotes
derive APR, strike, collateral ratio, maturity, and asset labels from the
selected market.

Environment variables (with defaults for local dev in parens):

- `DATABASE_URL` (`jdbc:postgresql://localhost:5432/awakening`)
- `DATABASE_USER` (`awakening`)
- `DATABASE_PASSWORD` (`awakening`)
- `AWAKENING_RPC_URL` (`http://localhost:8545`)
- `AWAKENING_CHAIN_ID` (`31337`)
- `AWAKENING_INDEXER_START_BLOCK` (`0`)
- `AWAKENING_INDEXER_CONFIRMATIONS` (`12`)
- `PORT` (`8080`)

## Package layout

```
xyz.hyperloop.awakening
├── market/        Market terms, Strike, PAT and depth
├── order/         Preview Borrow/Lend order lifecycle
├── position/      Credit, debt, collateral and PAT
├── settlement/    User settlement preview state machine
├── portfolio/     Compatibility adapter
└── api/           Validation and Problem Details
```
