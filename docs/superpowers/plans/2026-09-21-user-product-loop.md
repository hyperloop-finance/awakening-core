# Awakening User Product Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an API-backed User experience covering Markets, Orders, Positions, and Settlement with deterministic preview data and honest simulation-only actions.

**Architecture:** Extend the Spring Boot backend first so OpenAPI and tested endpoint behavior become the contract. Then extend the Next.js API adapter and build each user page against that contract. Preserve mock/API parity, keep decimal values as strings, and retain compatibility redirects/endpoints while renaming Portfolio to Positions.

**Tech Stack:** Java 21, Spring Boot 3.4, Maven, JUnit/MockMvc, OpenAPI 3.1, Next.js 15, React 19, TypeScript, wagmi/viem, Vitest, Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-21-user-product-loop-design.md`

## Global Constraints

- Modify only files inside the `Awakening` repository and its two existing worktrees.
- Backend implementation lives in `.worktrees/backend-v01` on `feat/backend-v01`.
- Frontend implementation lives in `.worktrees/frontend-v01` on `feat/frontend-v01`.
- Do not modify Solidity contracts in this iteration.
- Do not add Anvil, Sepolia, wallet signing, Maker Console, or Protocol Operations behavior.
- All order and settlement actions are deterministic preview behavior and must be labeled `Preview` or `Simulate` in the UI.
- Decimal monetary and rate values cross the API as plain strings; never use JavaScript floating-point arithmetic for them.
- API mode must never silently fall back to frontend mock data.
- Non-mock backend profiles without a real data source return `503` rather than fabricated data.
- Preserve existing unrelated changes; `ARCHITECTURE-OVERVIEW.md` is an untracked user document in the main worktree and must not be included in implementation commits.

---

## File Structure

### Backend worktree

Create focused domains:

```text
backend/src/main/java/xyz/hyperloop/awakening/
├── order/
│   ├── CreateOrderRequest.java
│   ├── Order.java
│   ├── OrderController.java
│   ├── OrderService.java
│   └── OrderStatus.java
├── position/
│   ├── PositionController.java
│   ├── PositionPayload.java
│   ├── PositionService.java
│   ├── PositionSummary.java
│   └── PositionTotals.java
└── settlement/
    ├── SettlementActionRequest.java
    ├── SettlementController.java
    ├── SettlementItem.java
    ├── SettlementPhase.java
    └── SettlementService.java
```

Keep the current `portfolio` package temporarily as a compatibility adapter. Do not duplicate business fixtures between Portfolio and Positions; compatibility delegates to `PositionService`.

### Frontend worktree

Create page-specific components and keep API code centralized:

```text
frontend/src/
├── app/
│   ├── orders/page.tsx
│   ├── positions/page.tsx
│   └── settlement/page.tsx
├── components/
│   ├── orders/orders-screen.tsx
│   ├── positions/positions-screen.tsx
│   └── settlement/settlement-screen.tsx
└── lib/
    ├── api/types.ts
    ├── api/client.ts
    ├── api/mock.ts
    ├── api/wire.ts
    └── state/user-product.ts
```

The old `/portfolio` route becomes a server redirect to `/positions`. Do not keep two independently implemented screens.

---

### Task 1: Synchronize the approved specification into both implementation worktrees

**Files:**
- Source commit: `main:d551bde`
- Add to backend branch: `docs/superpowers/specs/2026-09-21-user-product-loop-design.md`
- Add to frontend branch: `docs/superpowers/specs/2026-09-21-user-product-loop-design.md`

**Interfaces:**
- Consumes: approved design commit `d551bde`.
- Produces: identical spec available to both branch implementers.

- [ ] **Step 1: Confirm all three worktrees are clean except the known main-worktree document**

Run:

```bash
git -C Awakening status --short --branch
git -C Awakening/.worktrees/backend-v01 status --short --branch
git -C Awakening/.worktrees/frontend-v01 status --short --branch
```

Expected: main shows only `?? ARCHITECTURE-OVERVIEW.md`; both feature worktrees are clean.

- [ ] **Step 2: Cherry-pick the spec commit into the backend branch**

Run:

```bash
git -C Awakening/.worktrees/backend-v01 cherry-pick d551bde
```

Expected: a new backend-branch commit containing only the design spec.

- [ ] **Step 3: Cherry-pick the spec commit into the frontend branch**

Run:

```bash
git -C Awakening/.worktrees/frontend-v01 cherry-pick d551bde
```

Expected: a new frontend-branch commit containing only the design spec.

---

### Task 2: Extend backend market terms for Strike, PAT, and order-book preview

**Files:**
- Modify: `backend/src/main/java/xyz/hyperloop/awakening/market/MarketDetail.java`
- Modify: `backend/src/main/java/xyz/hyperloop/awakening/market/MarketService.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/market/OrderBookLevel.java`
- Modify: `backend/src/test/java/xyz/hyperloop/awakening/market/MarketApiTest.java`

**Interfaces:**
- Consumes: existing `MarketSummary` and market endpoint.
- Produces: `MarketDetail.strike`, `patStatus`, `patSource`, `patCoverage`, `borrowLevels`, and `lendLevels`.

- [ ] **Step 1: Write a failing Market API assertion**

Add assertions equivalent to:

```java
mockMvc.perform(get("/api/v1/markets/{marketId}", MarketService.BTC_USDC_90D))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.strike").value("60000.00"))
    .andExpect(jsonPath("$.patStatus").value("VERIFIED_PREVIEW"))
    .andExpect(jsonPath("$.patSource").value("ATTESTED_CUSTODIAN_PREVIEW"))
    .andExpect(jsonPath("$.patCoverage").value("0.9500"))
    .andExpect(jsonPath("$.borrowLevels[0].apr").value("0.0825"))
    .andExpect(jsonPath("$.borrowLevels[0].availableAmount").value("75000.00"))
    .andExpect(jsonPath("$.lendLevels[0].apr").value("0.0875"));
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd Awakening/.worktrees/backend-v01/backend
./mvnw -Dtest=MarketApiTest test
```

Expected: FAIL because the new fields do not exist.

- [ ] **Step 3: Implement immutable order-book levels and market fields**

Create:

```java
package xyz.hyperloop.awakening.market;

public record OrderBookLevel(String apr, String availableAmount) { }
```

Extend `MarketDetail` with:

```java
String strike,
String patStatus,
String patSource,
List<OrderBookLevel> borrowLevels,
List<OrderBookLevel> lendLevels
```

Return deterministic values from `MarketService.getMarket`:

```java
"60000.00",
"VERIFIED_PREVIEW",
"ATTESTED_CUSTODIAN_PREVIEW",
List.of(new OrderBookLevel("0.0825", "75000.00"), new OrderBookLevel("0.0850", "100000.00")),
List.of(new OrderBookLevel("0.0875", "80000.00"), new OrderBookLevel("0.0900", "95000.00"))
```

- [ ] **Step 4: Run market tests**

Run:

```bash
./mvnw -Dtest=MarketApiTest,MarketClockApiTest,MarketRuntimeConfigApiTest test
```

Expected: PASS.

- [ ] **Step 5: Commit the market contract**

```bash
git add backend/src/main/java/xyz/hyperloop/awakening/market backend/src/test/java/xyz/hyperloop/awakening/market
git commit -m "feat(backend): expose market protection and order depth"
```

---

### Task 3: Add the backend Orders API

**Files:**
- Create: `backend/src/main/java/xyz/hyperloop/awakening/order/OrderStatus.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/order/CreateOrderRequest.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/order/Order.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/order/OrderService.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/order/OrderController.java`
- Create: `backend/src/test/java/xyz/hyperloop/awakening/order/OrderApiTest.java`

**Interfaces:**
- Consumes: `MarketService.getMarket`, `DecimalStrings.parse`, injected `Clock`.
- Produces:
  - `List<Order> list(String wallet, String side)`
  - `Order create(CreateOrderRequest request)`
  - `Order cancel(String id, String wallet)`

- [ ] **Step 1: Write failing create/list/cancel tests**

Test request:

```json
{
  "wallet":"0xde00000000000000000000000000000000000001",
  "marketId":"0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6",
  "side":"BORROW",
  "amount":"5000",
  "apr":"0.081",
  "expiry":"2026-12-01T00:00:00Z"
}
```

Assert `201`, normalized decimals, `OPEN`, `filledAmount=0`, `remainingAmount=5000`, then list by wallet/side, cancel, and assert `CANCELLED`.

- [ ] **Step 2: Run focused test and verify failure**

```bash
./mvnw -Dtest=OrderApiTest test
```

Expected: FAIL with missing endpoint/classes.

- [ ] **Step 3: Define order types**

Use:

```java
public enum OrderStatus { OPEN, PARTIALLY_FILLED, FILLED, CANCELLED, EXPIRED }
```

```java
public record CreateOrderRequest(
    String wallet,
    String marketId,
    String side,
    String amount,
    String apr,
    Instant expiry
) { }
```

```java
public record Order(
    String id,
    String wallet,
    String marketId,
    String side,
    String amount,
    String filledAmount,
    String remainingAmount,
    String apr,
    Instant expiry,
    OrderStatus status,
    Instant createdAt
) { }
```

- [ ] **Step 4: Implement validated in-memory service**

Use `ConcurrentHashMap<String, Order>` and `AtomicLong`. Validate:

```text
wallet: 0x + 40 hex
side: BORROW or LEND
market: must exist and be OPEN
amount: positive, minimum market amount, max 8 decimals
apr: positive and <= 1.0 decimal rate
expiry: future and no later than market maturity
```

Before returning/listing an order, derive `EXPIRED` when `clock.instant()` is after expiry. Cancellation accepts only `OPEN` and `PARTIALLY_FILLED`; otherwise throw `409`.

- [ ] **Step 5: Implement controller routes**

```java
@GetMapping
List<Order> list(@RequestParam String wallet, @RequestParam(required = false) String side)

@PostMapping
@ResponseStatus(HttpStatus.CREATED)
Order create(@RequestBody CreateOrderRequest request)

@DeleteMapping("/{orderId}")
Order cancel(@PathVariable String orderId, @RequestParam String wallet)
```

- [ ] **Step 6: Add invalid-input and transition tests**

Cover invalid wallet, side, amount, APR, expired expiry, unknown order, wrong owner, and cancellation after cancellation. Assert `400`, `404`, or `409` as specified.

- [ ] **Step 7: Run order and full backend tests**

```bash
./mvnw -Dtest=OrderApiTest test
./mvnw test
```

Expected: PASS.

- [ ] **Step 8: Commit Orders API**

```bash
git add backend/src/main/java/xyz/hyperloop/awakening/order backend/src/test/java/xyz/hyperloop/awakening/order
git commit -m "feat(backend): add preview order lifecycle API"
```

---

### Task 4: Replace Portfolio business data with whitepaper-aligned Positions

**Files:**
- Create: `backend/src/main/java/xyz/hyperloop/awakening/position/PositionSummary.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/position/PositionTotals.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/position/PositionPayload.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/position/PositionService.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/position/PositionController.java`
- Modify: `backend/src/main/java/xyz/hyperloop/awakening/portfolio/PortfolioService.java`
- Create: `backend/src/test/java/xyz/hyperloop/awakening/position/PositionApiTest.java`
- Modify: `backend/src/test/java/xyz/hyperloop/awakening/portfolio/PortfolioApiTest.java`

**Interfaces:**
- Consumes: `MarketService.BTC_USDC_90D`, injected `Clock`.
- Produces: `PositionPayload getPositions(String wallet)` and compatibility mapping for `/portfolio`.

- [ ] **Step 1: Write the failing Positions API test**

Request the shared demo wallet and assert:

```java
.andExpect(jsonPath("$.wallet").value("0xde00000000000000000000000000000000000001"))
.andExpect(jsonPath("$.borrowPositions[0].debtUnits").value("1200.00"))
.andExpect(jsonPath("$.borrowPositions[0].strike").value("60000.00"))
.andExpect(jsonPath("$.borrowPositions[0].patStatus").value("ATTRIBUTED_PREVIEW"))
.andExpect(jsonPath("$.lendPositions[0].creditUnits").value("800.00"))
.andExpect(jsonPath("$.lendPositions[0].faceValue").value("800.00"));
```

- [ ] **Step 2: Run the test and verify failure**

```bash
./mvnw -Dtest=PositionApiTest test
```

Expected: FAIL because `/api/v1/positions/{wallet}` does not exist.

- [ ] **Step 3: Define Position response records**

`PositionSummary` fields:

```java
String id,
String marketId,
String side,
String principal,
String collateral,
String creditUnits,
String debtUnits,
String faceValue,
String fixedApr,
String strike,
String patStatus,
String patCoverage,
Instant maturity,
String settlementState
```

`PositionTotals` fields:

```java
String borrowedPrincipal,
String lentPrincipal,
String collateralLocked,
String creditFaceValue,
String debtOutstanding
```

- [ ] **Step 4: Implement deterministic PositionService**

Use one constant:

```java
public static final String DEMO_WALLET = "0xde00000000000000000000000000000000000001";
```

Return one Borrow and one Lend position for this wallet; return empty positions and zero totals for other valid wallets. Set `patStatus=ATTRIBUTED_PREVIEW`, `patCoverage=0.9500`, and derive `OPEN/MATURED` from the injected clock.

- [ ] **Step 5: Add Positions controller and Portfolio compatibility**

Expose:

```java
@GetMapping("/api/v1/positions/{wallet}")
PositionPayload getPositions(@PathVariable String wallet)
```

Change Portfolio compatibility to derive its legacy response from `PositionService`, preserving the legacy JSON shape and tests.

- [ ] **Step 6: Run position and compatibility tests**

```bash
./mvnw -Dtest=PositionApiTest,PortfolioApiTest,PortfolioMaturityApiTest,PortfolioProfileApiTest test
```

Expected: PASS.

- [ ] **Step 7: Commit Positions API**

```bash
git add backend/src/main/java/xyz/hyperloop/awakening/position backend/src/main/java/xyz/hyperloop/awakening/portfolio backend/src/test/java/xyz/hyperloop/awakening/position backend/src/test/java/xyz/hyperloop/awakening/portfolio
git commit -m "feat(backend): expose protected user positions"
```

---

### Task 5: Add user Settlement preview API

**Files:**
- Create: `backend/src/main/java/xyz/hyperloop/awakening/settlement/SettlementPhase.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/settlement/SettlementAction.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/settlement/SettlementActionRequest.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/settlement/SettlementItem.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/settlement/SettlementService.java`
- Create: `backend/src/main/java/xyz/hyperloop/awakening/settlement/SettlementController.java`
- Create: `backend/src/test/java/xyz/hyperloop/awakening/settlement/SettlementApiTest.java`

**Interfaces:**
- Consumes: `PositionService.getPositions(wallet)`.
- Produces:
  - `List<SettlementItem> list(String wallet)`
  - `SettlementItem act(String positionId, SettlementActionRequest request)`

- [ ] **Step 1: Write failing settlement list and action tests**

Assert list items expose:

```json
{
  "positionId":"borrow-demo-1",
  "side":"BORROW",
  "phase":"PRE_MATURITY",
  "outstandingDebt":"1200.00",
  "recoverableCollateral":"0.03000000",
  "claimablePayout":"0",
  "claimableResidual":"0",
  "patStatus":"ATTRIBUTED_PREVIEW",
  "availableActions":[]
}
```

Use a fixed post-maturity test clock to assert `REPAYMENT_AVAILABLE` and `SIMULATE_REPAY_DEBT` availability. Submit the action and assert updated `FINALIZED` preview state.

- [ ] **Step 2: Run focused test and verify failure**

```bash
./mvnw -Dtest=SettlementApiTest test
```

Expected: FAIL with missing endpoint.

- [ ] **Step 3: Define settlement enums and records**

```java
public enum SettlementPhase {
    PRE_MATURITY, REPAYMENT_AVAILABLE, READY_TO_CLAIM, FINALIZED
}
```

```java
public enum SettlementAction {
    SIMULATE_REPAY_DEBT,
    SIMULATE_RECOVER_COLLATERAL,
    SIMULATE_CLAIM_LENDER_PAYOUT,
    SIMULATE_CLAIM_RESIDUAL_PROCEEDS
}
```

`SettlementActionRequest` contains `wallet` and `action`. `SettlementItem` contains all fields from the approved spec plus `List<SettlementAction> availableActions` and `boolean simulated`.

- [ ] **Step 4: Implement deterministic state transitions**

Rules:

```text
Before maturity:
  phase PRE_MATURITY; no settlement action.

Borrow after maturity:
  phase REPAYMENT_AVAILABLE;
  allow SIMULATE_REPAY_DEBT.
  After repay preview, allow SIMULATE_RECOVER_COLLATERAL.
  After collateral recovery, FINALIZED.

Lend after maturity:
  phase READY_TO_CLAIM;
  allow SIMULATE_CLAIM_LENDER_PAYOUT.
  After claim, FINALIZED.

Residual action:
  expose only when claimableResidual > 0.
```

Store per-position simulated progress in a `ConcurrentHashMap`. Wrong wallet, unknown position, or invalid transition returns `404` or `409`.

- [ ] **Step 5: Implement controller routes**

```java
@GetMapping("/api/v1/settlements/{wallet}")
List<SettlementItem> list(@PathVariable String wallet)

@PostMapping("/api/v1/settlements/{positionId}/actions")
SettlementItem act(@PathVariable String positionId, @RequestBody SettlementActionRequest request)
```

- [ ] **Step 6: Test all phases and invalid transitions**

Use test clocks before and after maturity. Cover Borrow repayment/recovery, Lend payout claim, unknown position, wrong wallet, duplicated action, and non-mock profile `503` behavior.

- [ ] **Step 7: Run settlement and full backend suite**

```bash
./mvnw -Dtest=SettlementApiTest test
./mvnw test
```

Expected: PASS.

- [ ] **Step 8: Commit Settlement API**

```bash
git add backend/src/main/java/xyz/hyperloop/awakening/settlement backend/src/test/java/xyz/hyperloop/awakening/settlement
git commit -m "feat(backend): add user settlement preview lifecycle"
```

---

### Task 6: Update and validate OpenAPI

**Files:**
- Modify: `docs/api/openapi.yaml`
- Create: `backend/src/test/java/xyz/hyperloop/awakening/api/OpenApiContractTest.java`

**Interfaces:**
- Consumes: finalized endpoint records from Tasks 2–5.
- Produces: canonical request/response contract for frontend implementation.

- [ ] **Step 1: Write a failing OpenAPI presence test**

Load `../docs/api/openapi.yaml` or a classpath copy and assert it contains paths:

```text
/api/v1/orders
/api/v1/orders/{orderId}
/api/v1/positions/{wallet}
/api/v1/settlements/{wallet}
/api/v1/settlements/{positionId}/actions
```

Also assert schemas `Order`, `PositionPayload`, `PositionSummary`, `SettlementItem`, and `SettlementActionRequest` exist.

- [ ] **Step 2: Run test and verify failure**

```bash
./mvnw -Dtest=OpenApiContractTest test
```

Expected: FAIL because paths/schemas are absent.

- [ ] **Step 3: Update OpenAPI with exact endpoint schemas**

Document enums, required fields, plain decimal strings, response codes, compatibility `/portfolio`, and preview-only descriptions. Do not document any signing or on-chain execution.

- [ ] **Step 4: Run contract and backend tests**

```bash
./mvnw -Dtest=OpenApiContractTest test
./mvnw test
./mvnw package
```

Expected: all tests and package PASS.

- [ ] **Step 5: Commit API contract**

```bash
git add -f docs/api/openapi.yaml
git add backend/src/test/java/xyz/hyperloop/awakening/api/OpenApiContractTest.java
git commit -m "docs(api): define user orders positions and settlement"
```

---

### Task 7: Extend frontend types, parsers, client, and mock parity

**Files:**
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/wire.ts`
- Modify: `frontend/src/lib/api/client.ts`
- Modify: `frontend/src/lib/api/mock.ts`
- Modify: `frontend/src/lib/api/wire.test.ts`
- Modify: `frontend/src/lib/api/client.test.ts`
- Create: `frontend/src/lib/api/user-product.test.ts`

**Interfaces:**
- Consumes: OpenAPI schemas from Task 6.
- Produces frontend types and methods:
  - `orders(wallet, side?, signal?)`
  - `createOrder(input, signal?)`
  - `cancelOrder(id, wallet, signal?)`
  - `positions(wallet, signal?)`
  - `settlements(wallet, signal?)`
  - `simulateSettlementAction(positionId, input, signal?)`

- [ ] **Step 1: Write failing parser tests**

Create valid fixtures for MarketDetail, Order, PositionPayload, and SettlementItem. Assert exact parsing and rejection of:

- invalid order status;
- numeric amount instead of string;
- zero/invalid addresses;
- invalid settlement phase;
- unsupported action;
- missing PAT fields.

- [ ] **Step 2: Run parser tests and verify failure**

```bash
cd Awakening/.worktrees/frontend-v01/frontend
pnpm test -- src/lib/api/wire.test.ts src/lib/api/user-product.test.ts
```

Expected: FAIL because the types/parsers do not exist.

- [ ] **Step 3: Add exact TypeScript types**

Define:

```ts
type OrderSide = "BORROW" | "LEND";
type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "EXPIRED";
type SettlementPhase = "PRE_MATURITY" | "REPAYMENT_AVAILABLE" | "READY_TO_CLAIM" | "FINALIZED";
type SettlementAction =
  | "SIMULATE_REPAY_DEBT"
  | "SIMULATE_RECOVER_COLLATERAL"
  | "SIMULATE_CLAIM_LENDER_PAYOUT"
  | "SIMULATE_CLAIM_RESIDUAL_PROCEEDS";
```

Add the fields specified by OpenAPI without optionalizing required server data.

- [ ] **Step 4: Implement runtime parsers**

Add `parseOrder`, `parseOrders`, `parsePositionPayload`, `parseSettlementItem`, and `parseSettlements`. Reuse the existing `object`, `text`, `bool`, `integer`, and `enumeration` helpers.

- [ ] **Step 5: Implement API client methods**

Use `request` and URL encoding. `DELETE` returns the updated cancelled Order. `POST` bodies use JSON and accept AbortSignal.

- [ ] **Step 6: Implement deterministic frontend mock parity**

Use the same demo wallet, fixtures, statuses, fields and transition rules as the backend. Keep mutable mock state module-local and expose a test reset helper only from a test-specific export or through module reset.

- [ ] **Step 7: Run API unit tests**

```bash
pnpm test -- src/lib/api/wire.test.ts src/lib/api/client.test.ts src/lib/api/user-product.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit frontend data contract**

```bash
git add frontend/src/lib/api
git commit -m "feat(frontend): add user product API contract"
```

---

### Task 8: Update app shell and Markets user actions

**Files:**
- Modify: `frontend/src/components/shell/app-shell.tsx`
- Modify: `frontend/src/components/shell/app-shell.test.tsx`
- Modify: `frontend/src/components/markets/markets-screen.tsx`
- Modify: `frontend/src/components/markets/markets-screen.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: extended `MarketDetail` and new routes.
- Produces navigation to `/markets`, `/orders`, `/positions`, `/settlement`, plus market action links with query parameters.

- [ ] **Step 1: Write failing navigation and market-action tests**

Assert navigation includes:

```text
Markets
Orders
Positions
Settlement
```

For a market row/detail assert links:

```text
/borrow/{marketId}
/lend/{marketId}
/orders?marketId={marketId}&side=BORROW
/orders?marketId={marketId}&side=LEND
```

Assert Strike and PAT coverage/source labels render.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
pnpm test -- src/components/shell/app-shell.test.tsx src/components/markets/markets-screen.test.tsx
```

Expected: FAIL on missing navigation/actions/fields.

- [ ] **Step 3: Implement shell navigation**

Replace the current two-link array with four links. Keep responsive behavior and active-path matching.

- [ ] **Step 4: Implement market terms and four actions**

Render protection terms from the selected market/detail. Label immediate links `Borrow now` and `Lend now`; label order links `Place borrow order` and `Place lend order`.

- [ ] **Step 5: Add responsive styles without redesigning the visual system**

Extend existing classes for four-action wrapping, terms, and order-book rows. Preserve current tokens, typography, focus states, and 44px mobile controls.

- [ ] **Step 6: Run component tests and lint**

```bash
pnpm test -- src/components/shell/app-shell.test.tsx src/components/markets/markets-screen.test.tsx
pnpm lint
```

Expected: PASS.

- [ ] **Step 7: Commit navigation and Markets**

```bash
git add frontend/src/components/shell frontend/src/components/markets frontend/src/app/globals.css
git commit -m "feat(frontend): expose user market actions"
```

---

### Task 9: Build Orders page

**Files:**
- Create: `frontend/src/app/orders/page.tsx`
- Create: `frontend/src/components/orders/orders-screen.tsx`
- Create: `frontend/src/components/orders/order-form.ts`
- Create: `frontend/src/components/orders/order-form.test.ts`
- Create: `frontend/src/components/orders/orders-screen.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: order API methods and `useWalletIdentity`.
- Produces a unified Borrow/Lend order creation and management page.

- [ ] **Step 1: Write failing pure form validation tests**

Test `validateOrderDraft` for valid input, invalid amount, invalid APR, past expiry, and missing wallet/market. Its signature is:

```ts
function validateOrderDraft(draft: OrderDraft, now: Date): Record<string, string>
```

- [ ] **Step 2: Run the form test and verify failure**

```bash
pnpm test -- src/components/orders/order-form.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement minimal pure validation**

Use the existing fixed-decimal helpers. Accept APR as a user percentage and convert it to a decimal API rate using `percentToDecimalRate` only at request construction.

- [ ] **Step 4: Write failing Orders screen tests**

Cover:

- disconnected state with Demo Wallet action;
- Borrow/Lend tab filtering;
- prefill from `marketId` and `side` query parameters;
- successful create refreshes list;
- cancel changes displayed status;
- loading/error/empty states;
- preview-only copy.

- [ ] **Step 5: Run screen test and verify failure**

```bash
pnpm test -- src/components/orders/orders-screen.test.tsx
```

Expected: FAIL because page/screen do not exist.

- [ ] **Step 6: Implement OrdersScreen**

Use AbortController plus generation guards for list refresh. Disable submit while invalid or pending. Render status badges and amount/fill/remaining/APR/expiry. Cancel only open or partially filled orders and require explicit button activation.

- [ ] **Step 7: Add route and responsive styles**

`app/orders/page.tsx` renders `<OrdersScreen />`. Use existing panels, tables/cards and form controls; do not introduce a separate visual system.

- [ ] **Step 8: Run Orders tests and lint**

```bash
pnpm test -- src/components/orders/order-form.test.ts src/components/orders/orders-screen.test.tsx
pnpm lint
```

Expected: PASS.

- [ ] **Step 9: Commit Orders page**

```bash
git add frontend/src/app/orders frontend/src/components/orders frontend/src/app/globals.css
git commit -m "feat(frontend): add user order management"
```

---

### Task 10: Rename Portfolio to Positions and add protected position details

**Files:**
- Create: `frontend/src/app/positions/page.tsx`
- Modify: `frontend/src/app/portfolio/page.tsx`
- Create: `frontend/src/components/positions/positions-screen.tsx`
- Create: `frontend/src/components/positions/positions-screen.test.tsx`
- Remove after replacement: `frontend/src/components/portfolio/portfolio-screen.tsx`
- Remove after replacement: `frontend/src/components/portfolio/portfolio-screen.test.tsx`
- Modify: `frontend/src/lib/state/flows.ts`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `awakeningApi.positions(wallet)`.
- Produces `/positions`; `/portfolio` redirects to `/positions`.

- [ ] **Step 1: Write failing Positions tests**

Cover disconnected, empty, error and populated states. Assert Borrow renders Debt Units, BTC Collateral, Strike, PAT Status, PAT Coverage and Maturity. Assert Lend renders Credit Units, Face Value, APR, Strike, PAT and Maturity.

- [ ] **Step 2: Run test and verify failure**

```bash
pnpm test -- src/components/positions/positions-screen.test.tsx
```

Expected: FAIL because screen does not exist.

- [ ] **Step 3: Implement position view derivation**

Replace Portfolio-specific derived types with `derivePositionsView(payload)` returning disconnected, empty, error, or populated states and separate Borrow/Lend arrays.

- [ ] **Step 4: Implement PositionsScreen and route**

Follow the current Portfolio request lifecycle but call the Positions endpoint. Keep semantic tables on desktop and direct cards on mobile.

- [ ] **Step 5: Replace Portfolio route with redirect**

Use Next.js server redirect:

```ts
import { redirect } from "next/navigation";

export default function PortfolioPage() {
  redirect("/positions");
}
```

- [ ] **Step 6: Remove superseded Portfolio component and update imports/tests**

Delete only after `rg "portfolio-screen" frontend/src` confirms no consumer remains except files being removed.

- [ ] **Step 7: Run Positions tests and lint**

```bash
pnpm test -- src/components/positions/positions-screen.test.tsx
pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit Positions migration**

```bash
git add frontend/src/app/positions frontend/src/app/portfolio frontend/src/components/positions frontend/src/components/portfolio frontend/src/lib/state/flows.ts frontend/src/app/globals.css
git commit -m "feat(frontend): replace portfolio with protected positions"
```

---

### Task 11: Build user Settlement page

**Files:**
- Create: `frontend/src/app/settlement/page.tsx`
- Create: `frontend/src/components/settlement/settlement-screen.tsx`
- Create: `frontend/src/components/settlement/settlement-screen.test.tsx`
- Create: `frontend/src/lib/state/settlement.ts`
- Create: `frontend/src/lib/state/settlement.test.ts`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: settlement API methods and shared wallet identity.
- Produces user-visible settlement phases and honest simulated actions.

- [ ] **Step 1: Write failing settlement view-model tests**

Define:

```ts
function settlementActionLabel(action: SettlementAction): string
```

Expected labels begin with `Simulate`: `Simulate repayment`, `Simulate collateral recovery`, `Simulate lender payout claim`, and `Simulate residual proceeds claim`.

Also test phase labels and action ordering.

- [ ] **Step 2: Run view-model tests and verify failure**

```bash
pnpm test -- src/lib/state/settlement.test.ts
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement pure settlement labels and ordering**

Map all enum values exhaustively with a `never` guard so newly added backend actions cannot render silently.

- [ ] **Step 4: Write failing Settlement screen tests**

Cover disconnected, loading, error, pre-maturity/no-action, Borrow repayment, Borrow collateral recovery, Lend payout claim, finalized state, action pending and action error. Assert every success message includes `preview` and says no transaction was sent.

- [ ] **Step 5: Run screen tests and verify failure**

```bash
pnpm test -- src/components/settlement/settlement-screen.test.tsx
```

Expected: FAIL because screen does not exist.

- [ ] **Step 6: Implement SettlementScreen**

Load items for the active wallet. Group by `PRE_MATURITY`, actionable, and finalized. Submit only actions supplied by `availableActions`; refresh the changed item from the response. Disable all item actions while its request is pending.

- [ ] **Step 7: Add route and responsive styles**

Use a lifecycle strip and position cards, preserving the current design tokens. Prominently display `Simulation only · no Anvil transaction`.

- [ ] **Step 8: Run Settlement tests and lint**

```bash
pnpm test -- src/lib/state/settlement.test.ts src/components/settlement/settlement-screen.test.tsx
pnpm lint
```

Expected: PASS.

- [ ] **Step 9: Commit Settlement page**

```bash
git add frontend/src/app/settlement frontend/src/components/settlement frontend/src/lib/state/settlement.ts frontend/src/lib/state/settlement.test.ts frontend/src/app/globals.css
git commit -m "feat(frontend): add user settlement preview"
```

---

### Task 12: Cross-profile integration, documentation, and final verification

**Files:**
- Modify: `frontend/README.md`
- Modify: `backend/README.md`
- Modify if behavior requires: `frontend/.env.local.example`
- Test all changed backend/frontend files.

**Interfaces:**
- Consumes: completed backend API and frontend UI.
- Produces a locally runnable, documented user product loop.

- [ ] **Step 1: Add an API-profile integration test or scripted verification**

Start backend in mock profile and frontend with:

```bash
NEXT_PUBLIC_DATA_PROFILE=api
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

Verify via browser or Playwright:

```text
Markets loads from API.
Demo wallet shows Positions.
Borrow and Lend order creation succeeds.
Order cancellation succeeds.
Settlement renders honest preview states.
/portfolio redirects to /positions.
No console error occurs.
```

- [ ] **Step 2: Update READMEs with exact local commands and preview limitations**

Document ports, profiles, demo wallet, endpoint list, in-memory reset behavior, and the absence of chain transactions.

- [ ] **Step 3: Run full backend verification**

```bash
cd Awakening/.worktrees/backend-v01/backend
./mvnw test
./mvnw package
```

Expected: all tests and package PASS.

- [ ] **Step 4: Stop frontend dev server before production build**

The Next.js dev server and production build share `.next`. Stop the dev process before building to avoid cache corruption.

- [ ] **Step 5: Run full frontend verification**

```bash
cd Awakening/.worktrees/frontend-v01/frontend
pnpm test
pnpm lint
pnpm build
```

Expected: all tests, lint and production build PASS.

- [ ] **Step 6: Inspect both worktrees and diff checks**

```bash
git -C Awakening/.worktrees/backend-v01 diff --check
git -C Awakening/.worktrees/frontend-v01 diff --check
git -C Awakening/.worktrees/backend-v01 status --short --branch
git -C Awakening/.worktrees/frontend-v01 status --short --branch
```

Expected: clean worktrees after commits.

- [ ] **Step 7: Commit documentation separately in each branch**

Backend:

```bash
git add backend/README.md
git commit -m "docs(backend): document user preview APIs"
```

Frontend:

```bash
git add frontend/README.md frontend/.env.local.example
git commit -m "docs(frontend): document user product loop"
```

- [ ] **Step 8: Present local links and remaining phase boundary**

Report:

```text
http://localhost:3000/markets
http://localhost:3000/orders
http://localhost:3000/positions
http://localhost:3000/settlement
http://localhost:8080/actuator/health
```

Explicitly state that Maker, Protocol and real Anvil execution remain the next phase.
