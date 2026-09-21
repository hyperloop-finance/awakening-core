# Awakening User Product Loop Design

**Date:** 2026-09-21  
**Status:** Approved in chat; awaiting written-spec review  
**Scope:** User-facing Markets, Orders, Positions, Settlement and matching backend APIs

## 1. Goal

Build a coherent user product loop before adding Maker, Protocol Operator, or real Anvil execution:

```text
Markets → Order or Take → Position → Settlement
```

This iteration must make the whitepaper concepts visible and testable through deterministic API-backed data without implying that simulated actions are on-chain.

## 2. Explicit Non-Goals

- No Solidity changes.
- No Anvil deployment or transaction execution.
- No Maker Console.
- No Protocol Operations Console.
- No wallet signature request.
- No PostgreSQL persistence or chain indexer.
- No Sepolia integration.

## 3. User Navigation

The primary user navigation becomes:

```text
Markets / Orders / Positions / Settlement
```

Existing Borrow and Lend routes remain market-scoped flows.

## 4. Markets

Markets remains the discovery and immediate-action surface.

Each market exposes:

- Collateral and loan asset.
- Fixed APR and maturity.
- Strike.
- Available liquidity and offer depth.
- PAT coverage and PAT source summary.
- Settlement state.
- `Borrow Now` and `Lend Now` actions.
- `Place Borrow Order` and `Place Lend Order` actions.
- A deterministic preview of order-book depth.

The “Now” actions continue into the existing quote flows. “Place Order” opens the Orders page with market and side preselected.

## 5. Orders

Orders is a single page with Borrow and Lend tabs.

### Create Order

Required inputs:

- Market ID.
- Side: `BORROW` or `LEND`.
- Amount.
- APR.
- Expiry.

The frontend validates plain positive decimals and future expiry. Creating an order calls the backend; no wallet signature is requested in this iteration.

### Order Lifecycle

Supported statuses:

```text
OPEN / PARTIALLY_FILLED / FILLED / CANCELLED / EXPIRED
```

An order returns original amount, filled amount, remaining amount, APR, timestamps, wallet and market ID. Users may cancel only `OPEN` or `PARTIALLY_FILLED` orders.

The mock backend stores orders in memory. Restarting the backend clears them; the UI must label the data source as preview data.

## 6. Positions

The existing Portfolio route and label become Positions. A compatibility redirect from `/portfolio` to `/positions` is retained.

Positions are divided into Borrow and Lend sections.

### Borrow Position Fields

- Position ID and market ID.
- Principal.
- Debt units.
- BTC collateral.
- Strike.
- Fixed APR.
- Maturity.
- PAT status and coverage.
- Settlement state.

### Lend Position Fields

- Position ID and market ID.
- Principal.
- Credit units.
- Face value at maturity.
- Fixed APR.
- Strike.
- PAT status and coverage.
- Maturity.
- Settlement state.

The frontend and backend use one shared deterministic demo wallet address.

## 7. User Settlement

Settlement is a user action surface, not the protocol operations console.

Supported user-facing phases:

```text
PRE_MATURITY / REPAYMENT_AVAILABLE / READY_TO_CLAIM / FINALIZED
```

Each settlement item exposes:

- Position and market IDs.
- User side.
- Maturity.
- Outstanding debt or claimable payout.
- Recoverable collateral.
- Claimable residual proceeds.
- PAT status.
- Available user actions.

Supported simulated actions:

```text
REPAY_DEBT
RECOVER_COLLATERAL
CLAIM_LENDER_PAYOUT
CLAIM_RESIDUAL_PROCEEDS
```

The backend validates whether an action is allowed for the current phase, returns the updated deterministic preview state, and never presents the action as an on-chain transaction. Buttons and success messages must say `Simulate` or `Preview`.

## 8. API Design

Existing endpoints remain:

```http
GET /api/v1/markets
GET /api/v1/markets/{marketId}
GET /api/v1/markets/{marketId}/quote
GET /api/v1/config
```

Portfolio is replaced by Positions while retaining temporary compatibility:

```http
GET /api/v1/positions/{wallet}
GET /api/v1/portfolio/{wallet}     # compatibility during migration
```

Orders:

```http
GET    /api/v1/orders?wallet={wallet}&side={side}
POST   /api/v1/orders
DELETE /api/v1/orders/{orderId}?wallet={wallet}
```

Settlement:

```http
GET  /api/v1/settlements/{wallet}
POST /api/v1/settlements/{positionId}/actions
```

All new schemas are added to `docs/api/openapi.yaml`. Decimal amounts remain strings to prevent floating-point loss.

## 9. Frontend Data Flow

Pages call only `awakeningApi`; they do not contain profile-specific branching.

```text
Page → awakeningApi → mock adapter or HTTP API → wire parser → view model
```

New API responses receive runtime parsers in `src/lib/api/wire.ts`. Request cancellation and stale-response guards follow the existing generation/AbortController pattern.

## 10. Backend Structure

New backend domains:

```text
order/
├── OrderController
├── OrderService
└── order request/response records

settlement/
├── SettlementController
├── SettlementService
└── settlement request/response records
```

The existing `portfolio` domain may be renamed to `position` or wrapped behind a new Positions controller without deleting compatibility behavior in this iteration.

In-memory state is thread-safe and scoped to the running backend process. Seed data remains deterministic for tests.

## 11. Error Handling

- Invalid wallet, market ID, amount, APR or expiry returns RFC Problem Details.
- Unknown orders and positions return `404`.
- Invalid cancellation or settlement transition returns `409`.
- Unsupported actions return `400`.
- Non-mock profiles without an implemented data source return `503` rather than fabricated data.
- Frontend error states provide retry where appropriate and never silently fall back from API to mock.

## 12. Testing

### Backend

- Market fields include Strike and PAT terms.
- Create/list/filter/cancel order tests.
- Invalid order and state-transition tests.
- Position schema and demo wallet tests.
- Settlement list and action-transition tests.
- Compatibility portfolio endpoint test.
- OpenAPI behavior alignment.

### Frontend

- Markets renders new terms and all four actions.
- Order creation, filtering, cancellation and state rendering.
- `/portfolio` compatibility redirect.
- Positions renders credit, debt, collateral and PAT fields.
- Settlement phase and permitted-action rendering.
- Wire parser rejection tests.
- Mock/API parity tests.
- Responsive layout and accessibility checks for new pages.

## 13. Delivery Boundary

This iteration is complete when a user can:

1. Inspect an Awakening market and its protection terms.
2. Preview an immediate Borrow/Lend path.
3. Create and cancel Borrow/Lend orders through the API.
4. Inspect whitepaper-aligned Borrow/Lend positions.
5. Simulate permitted user settlement actions with honest preview labeling.

Real signatures, Anvil transactions, Maker workflows and protocol settlement operations are deferred to the next design phase.
