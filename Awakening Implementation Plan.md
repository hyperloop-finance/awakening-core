# Awakening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Every contract-phase task follows TDD: **red → green → refactor → commit**. Steps use checkbox (`- [ ]`) syntax.

---

## Table of Contents

1. [Header — Goal, Architecture, Tech Stack](#header)
2. [Global Constraints](#0-global-constraints)
3. [Phase 0 — Workspace & Ground Rules](#phase-0--workspace--ground-rules)
4. [Phase 1 — Contracts](#phase-1--contracts)
5. [Phase 2 — Backend](#phase-2--backend-java--spring-boot)
6. [Phase 3 — Frontend](#phase-3--frontend-nextjs)
7. [Phase 4 — Testing & Acceptance](#phase-4--testing--acceptance)
8. [Appendix A — Worktree Recommendation](#appendix-a--worktree-recommendation)
9. [Appendix B — Open Questions Requiring Decisions](#appendix-b--open-questions-requiring-decisions)
10. [中文版](#中文版)

---

## Header

| Field | Value |
|---|---|
| **Goal** | Ship v0.1 of Awakening — a non-liquidative, fixed-rate, fixed-maturity BTC lending protocol on EVM — as an integrated system (contracts + backend + frontend) executing a full borrow → repay lifecycle on Sepolia with real Deribit-attested PAT. |
| **Architecture** | Based on Morpho Midnight; delete the liquidation surface; add a Put Attribution Token (PAT) layer that makers deliver at fill time. Off-chain services (Java indexer + offer relay + PAT attestation) sit between chain and a Next.js frontend. Oracle is read exactly once, at maturity. |
| **Contracts** | Solidity 0.8.x · Foundry · Certora |
| **Backend** | Java 21 · Spring Boot 3 · PostgreSQL 16 · Flyway · web3j |
| **Frontend** | Next.js 15 (App Router) · TypeScript · wagmi v2 · viem · RainbowKit · Tailwind · shadcn/ui |
| **Infra** | Docker Compose (local) · Fly.io / Render (backend) · Vercel (frontend) · Sepolia (v0.1 testnet) |

---

## 0. Global Constraints

Every task's requirements implicitly include this section. Copy to the top of any subagent brief.

| # | Rule |
|---|---|
| G1 | **Do not touch** Midnight source in `研究/白皮书 & Deck/code/`. Only edit `Awakening`. |
| G2 | **Rename discipline:** `Midnight` → `Awakening` happens once (Task 0.3), not scattered across feature commits. |
| G3 | **No liquidation logic may survive.** After Phase 1: `grep -rn 'liquidat\|LLTV\|LIF\|lossFactor\|isHealthy' contracts/src/` must return nothing. |
| G4 | **Oracle is never read before maturity.** At maturity (during settlement), each active `CollateralParams.oracle` is read exactly once. Multi-collateral markets therefore read N oracles at settlement, N = number of active collateral indices; zero reads before then. |
| G5 | **Solidity version** pinned to Midnight's version in `foundry.toml`. Do not upgrade in v0.1. |
| G6 | **Commit granularity:** one green test = one commit. Never batch unrelated changes. |
| G7 | **Coverage floor:** ≥ 95% line, ≥ 90% branch on `contracts/src/` before Phase 1 exits. |
| G8 | **Backend language:** Java 21. Exit clause in §0.3. |
| G9 | **Wallet-first UX:** every user action produces a readable transaction preview before signing. |
| G10 | **All PRs merge via review.** No direct commits to `main` after Task 0.3. |

### 0.1 Final Repo Layout

```
Awakening/
├── contracts/                       Foundry project (based on Midnight, purged & PAT'd)
│   ├── src/
│   │   ├── Awakening.sol                Renamed from Midnight.sol, ~700 lines
│   │   ├── settlement/
│   │   │   └── AwakeningSettlement.sol  NEW, ~250 lines
│   │   ├── pat/
│   │   │   ├── IPAT.sol
│   │   │   ├── AttestedPAT.sol          Off-chain attested (Deribit primary)
│   │   │   ├── DerivePAT.sol            On-chain native (Derive fallback)
│   │   │   └── ProtocolPAT.sol          Internal writer pool (gap-filler)
│   │   ├── interfaces/                  IMidnight.sol → IAwakening.sol
│   │   ├── libraries/                   Mostly unchanged; ConstantsLib purged
│   │   ├── ratifiers/                   Unchanged (full reuse)
│   │   └── periphery/                   Mostly unchanged; +1 PAT-aware bundle
│   ├── test/
│   ├── certora/                         Purged liquidation specs + new PAT invariant
│   └── script/                          Deploy scripts
├── backend/                             Java 21 + Spring Boot 3
│   ├── indexer/                         Chain event → Postgres
│   ├── offer-relay/                     Off-chain offer publication + query
│   ├── attestation/                     Deribit signature verification & feed
│   ├── router/                          Best-fill computation for takers
│   └── common/                          web3j bindings, DTOs, config
├── frontend/                            Next.js 15 App Router
│   ├── app/{markets,borrow,lend,portfolio}/
│   ├── components/
│   ├── lib/                             wagmi config, ABIs, hooks
│   └── e2e/                             Playwright specs
├── ops/
│   ├── docker-compose.yml               Local Postgres + anvil
│   └── deploy/                          Sepolia deploy scripts
├── audits/                              External reports
├── docs/                                Architecture docs
└── Awakening Implementation Plan.md     This file
```

### 0.2 Scope — v0.1 vs Deferred

**v0.1 (this plan) — confirmed 2026-08-01**

- **Multi-collateral markets** (up to 128 collateral types per market, per Midnight). Each `CollateralParams` entry gets its own strike, oracle, and PAT requirement.
- **Three PAT sources, tiered:**
  1. **Deribit off-chain attested** — primary liquidity for BTC / ETH puts
  2. **Derive on-chain native** — trustless fallback where Derive lists the strike / expiry
  3. **Protocol-internal writer pool** — fills gaps; Hyperloop or partnered market-makers underwrite directly
- Sepolia testnet only, no mainnet
- English UI only
- One market per (collateral-set, loan, maturity, strike-set) tuple; no cross-margin between markets

> **Design consequence of multi-collateral + tiered PAT:**
> A borrower posting mixed collateral (e.g. 0.5 BTC + 3 ETH) means the maker's `onBuy` callback returns an **array** of PAT attributions, one per collateral type used. Basket PATs are not sold on external venues, so we do not synthesize them. Each PAT is attributed against a specific `CollateralParams` index. Invariants become per-index (see Milestone 1D).

### 0.3 Java Backend Tradeoff — Explicit Decision Log

**Decision:** Java 21 + Spring Boot 3 for the backend.

**Why:** Troy is learning Java. Learning value > ecosystem fit for a solo-founder-led v0.1.

**Costs we accept**

1. web3j is slower-moving than viem/ethers.js — new EIPs may lag 3–6 months
2. No shared types with frontend (TS). Recommend OpenAPI schema → typegen for TS
3. Fewer indexer templates (Ponder / Envio / Subsquid / Goldsky are all TS/Rust). Expect extra work vs Ponder equivalent
4. Future hires almost always prefer Node/Rust for crypto backend

**Exit criterion:** If at end of Milestone 2A (skeleton + first event indexed) daily-loss-of-velocity feels > 30%, switch to Node + TypeScript. **Do not switch after Milestone 2C.**

**What we do NOT accept:** Java for frontend or on-chain code. Contracts stay Solidity; frontend stays TypeScript.

### 0.4 Order of Work & Why

`Contracts → Backend → Frontend`, with slight overlap:

1. **Contracts first.** They define the ABI everything else consumes. Ship-blocking; also the most audit-sensitive.
2. **Backend starts when Milestone 1D lands.** ABI 80% stable at that point.
3. **Frontend starts when Milestone 1E lands + backend Milestone 2C.** Needs stable ABI and a working backend API.

This is *not* the fastest theoretical order. It's the safest — the piece with the longest audit tail (contracts) blocks least on other pieces.

### 0.5 Testing Philosophy

| Layer | Approach |
|---|---|
| **Contracts** | Strict TDD. Foundry unit + invariant + fuzz. Certora for specs. |
| **Backend** | Test-first for state-mutating handlers. Testcontainers for Postgres. Integration > unit. |
| **Frontend** | Playwright e2e > unit. Component tests only for pure UI (formatters, hooks). |
| **CI** | No `skip` / `only` in committed tests. All checks pass on `main`. |

### 0.6 Brainstorming Gate

Before starting Phase 1: if any part of this plan feels wrong — the tech stack, the scope cut, the PAT source — invoke `superpowers:brainstorming` to re-open the question. Don't grind through a plan you disagree with.

---

## Phase 0 — Workspace & Ground Rules

Bring the repo to a known-good baseline before touching business logic.

---

### Task 0.1 — Confirm Baseline Builds

**Files:** `contracts/foundry.toml`, `contracts/lib/`

- [ ] **Step 1: Install foundry + dependencies**
  ```bash
  cd Awakening/contracts
  forge install
  ```
- [ ] **Step 2: Baseline build**
  ```bash
  forge build
  ```
  Expected: clean build.
- [ ] **Step 3: Baseline test**
  ```bash
  forge test --gas-report | tee ../ops/baseline-test-report.txt
  ```
  Expected: all Midnight tests pass. Save the report — reference for what we may break vs. must preserve.
- [ ] **Step 4: Commit**
  ```bash
  git add ops/baseline-test-report.txt
  git commit -m "chore: capture baseline Midnight test output"
  ```

---

### Task 0.2 — Branch Strategy + Protection

- [ ] **Step 1:** Create `main` branch protection rule (no direct push, PR + 1 review + CI green)
- [ ] **Step 2:** Create `feat/awakening-purge-liquidation` branch for Milestone 1A
- [ ] **Step 3:** Document branch strategy in `docs/CONTRIBUTING.md` (create if missing, 15 lines max)

---

### Task 0.3 — Rename Midnight → Awakening (Bulk, Mechanical)

**Files:** everything in `contracts/src/**/*.sol`, `contracts/test/**/*.sol`, `contracts/foundry.toml`, `contracts/README.md`

- [ ] **Step 1: Rename files**
  ```bash
  git mv contracts/src/Midnight.sol contracts/src/Awakening.sol
  git mv contracts/src/interfaces/IMidnight.sol contracts/src/interfaces/IAwakening.sol
  git mv contracts/src/periphery/MidnightBundles.sol contracts/src/periphery/AwakeningBundles.sol
  ```
- [ ] **Step 2: Search-and-replace identifiers**
  ```bash
  cd contracts
  grep -rl "Midnight" src test script | xargs sed -i '' 's/Midnight/Awakening/g'
  grep -rl "midnight" src test script | xargs sed -i '' 's/midnight/awakening/g'
  grep -rl "MIDNIGHT" src test script | xargs sed -i '' 's/MIDNIGHT/AWAKENING/g'
  ```
- [ ] **Step 3: Update `CALLBACK_SUCCESS` magic hash** — string `"morpho.midnight.callbackSuccess"` becomes `"hyperloop.awakening.callbackSuccess"` in `ConstantsLib.sol`
- [ ] **Step 4: Build + test**
  ```bash
  forge build && forge test
  ```
  Expected: all tests still pass — rename is mechanical.
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "refactor: rename Midnight → Awakening across sources and tests"
  ```

---

### Task 0.4 — Verify Certora Specs Run (Optional)

- [ ] Install Certora prover CLI, get access key
- [ ] Run one spec end-to-end: `certoraRun certora/confs/Bitmap.conf`
- [ ] If pass → good. If fail because of Awakening rename → update spec's contract references

---

## Phase 1 — Contracts

**Reference:** `docs/midnight-架构详解.md` §5.1 is the authoritative change list. This phase implements it task by task.

Milestones:
- **1A** — Purge Liquidation Surface
- **1B** — Add Strike & Maturity Discipline
- **1C** — PAT Interface & Reference Adapters
- **1D** — Rewire `take()` for PAT Attribution
- **1E** — Settlement Contract
- **1F** — Fee Tweaks & Cleanup
- **1G** — Test Coverage & Certora

---

### Milestone 1A — Purge Liquidation Surface

Delete every trace of liquidation from Awakening.sol. Tests referencing it get deleted, not skipped.

#### Task 1A.1 — Delete `ILiquidateCallback` + `ILiquidatorGate`

**Files:** `contracts/src/interfaces/ICallbacks.sol`, `contracts/src/interfaces/IGate.sol`

- [ ] **Step 1: Write failing test**
  ```solidity
  // test/Purge.t.sol
  function test_ILiquidateCallback_does_not_exist() public {
      assertTrue(true, "run: ! grep -r 'ILiquidateCallback' src");
  }
  ```
- [ ] **Step 2:** Delete the `ILiquidateCallback` block from `ICallbacks.sol`; delete `ILiquidatorGate` from `IGate.sol`
- [ ] **Step 3:** `forge build` — expect errors from every file importing the deleted interface. Delete those imports.
- [ ] **Step 4: Add CI check**
  ```yaml
  # .github/workflows/forge.yml — append
  - name: Assert no liquidation surface
    run: |
      ! grep -rn 'ILiquidateCallback\|ILiquidatorGate\|liquidate(' src/
  ```
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(purge): remove ILiquidateCallback and ILiquidatorGate"
  ```

#### Task 1A.2 — Delete `liquidate()` Function

**Files:** `contracts/src/Awakening.sol` (~ lines 590–729)

- [ ] **Step 1: Write failing test**
  ```solidity
  function test_liquidate_selector_not_present() public {
      bytes4 sel = bytes4(keccak256("liquidate(Market,address,uint256,uint256,address,bytes)"));
      (bool ok, ) = address(awakening).staticcall(abi.encodeWithSelector(sel));
      assertFalse(ok, "liquidate selector must be gone");
  }
  ```
- [ ] **Step 2:** Delete the function and all private `_liquidate*` helpers
- [ ] **Step 3:** `forge build` — expect breakage in tests referencing liquidation. Fix in Task 1A.3.
- [ ] **Step 4: Commit**
  ```bash
  git commit -am "feat(purge): delete liquidate() function and helpers"
  ```

#### Task 1A.3 — Delete Liquidation Tests

**Files:** every `contracts/test/**/*Liquidat*.t.sol`

- [ ] **Step 1:** `find contracts/test -iname '*liquidat*'` — review each file
- [ ] **Step 2:** Delete files that are 100% about liquidation. For mixed files, extract non-liquidation tests to a new file and delete the original.
- [ ] **Step 3:** `forge test` → green
- [ ] **Step 4: Commit**
  ```bash
  git commit -am "test(purge): remove liquidation-only test files"
  ```

#### Task 1A.4 — Delete Slashing (`lossFactor`) Machinery

**Files:** `contracts/src/Awakening.sol`, `contracts/src/interfaces/IAwakening.sol`

- [ ] **Step 1: Write failing test**
  ```solidity
  function test_no_lossFactor_in_marketState() public {
      (uint128 totalUnits, uint128 withdrawable, /* no lossFactor */) = awakening.marketState(id);
      // If MarketState struct changed, destructure fails to compile — that's the check.
  }
  ```
- [ ] **Step 2:** Remove `lossFactor` from `MarketState` struct in `IAwakening.sol`
- [ ] **Step 3:** Remove `lastLossFactor` from `Position` struct
- [ ] **Step 4:** Remove every reference in `Awakening.sol`; `_updatePosition` becomes simpler
- [ ] **Step 5:** `forge build && forge test` → green
- [ ] **Step 6: Commit**
  ```bash
  git commit -am "feat(purge): remove lossFactor slashing (no bad debt in Awakening)"
  ```

#### Task 1A.5 — Delete `isHealthy` + Health-Check Callsites

**Files:** `contracts/src/Awakening.sol`

- [ ] **Step 1: Write failing test**
  ```solidity
  function test_withdrawCollateral_no_healthCheck() public {
      // In Midnight: reverts (unhealthy). In Awakening: succeeds
      // (collateral bound via PAT, not via health).
      vm.expectRevert();  // temp — changes in Milestone 1E
      awakening.withdrawCollateral(market, 0, borrower_collateral_amount, borrower, borrower);
  }
  ```
- [ ] **Step 2:** Delete `isHealthy` and every call site
- [ ] **Step 3:** Note temporary invariant violation — borrower could withdraw collateral while owing debt. Milestone 1E fixes with collateral lock. Add TODO at top of `Awakening.sol`.
- [ ] **Step 4:** `forge test` — accept temp breakage. Annotate broken tests `// TODO: Milestone 1E — collateral lock`
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(purge): remove isHealthy checks (temp: unlocked collateral until 1E)"
  ```

#### Task 1A.6 — Delete `LIQUIDATION_LOCK` + LIF/RCF/LLTV

**Files:** `contracts/src/libraries/ConstantsLib.sol`, `contracts/src/Awakening.sol`, `contracts/src/libraries/UtilsLib.sol`

- [ ] **Step 1:** Delete `LIQUIDATION_LOCK_SLOT`, `LLTV_0..8`, `TIME_TO_MAX_LIF`, `LIQUIDATION_CURSOR_*`, `isLltvAllowed`, `maxLif`
- [ ] **Step 2:** Grep every constant; delete all references
- [ ] **Step 3:** Remove `tExchange` / `tGet` from `UtilsLib.sol` if only used by liquidation lock
- [ ] **Step 4:** `forge build && forge test`
- [ ] **Step 5:** CI grep must now enforce: no `LLTV`, `LIF`, `RCF`, `lossFactor`, `liquidat` in `src/`
- [ ] **Step 6: Commit**
  ```bash
  git commit -am "feat(purge): delete LIF/RCF/LLTV constants and liquidation lock"
  ```

#### Task 1A.7 — Milestone 1A Gate

- [ ] `grep -rn 'liquidat\|LLTV\|LIF\|lossFactor\|isHealthy' contracts/src/` returns nothing
- [ ] `forge test` all green
- [ ] Run `superpowers:requesting-code-review` on this milestone
- [ ] Merge feature branch to `main` after review

---

### Milestone 1B — Add Per-Collateral Strike Discipline

Because v0.1 keeps Midnight's multi-collateral runtime, **strike lives on `CollateralParams`**, not on `Market`. Each collateral index has its own strike, oracle, and PAT requirement. `maxDebt` for a position becomes:

```
maxDebt = Σ (position.collateral[i] × collateralParams[i].strike)   over i ∈ active bitmap
```

The old Midnight formula `Σ c_i × p_i × LLTV_i` is replaced entirely — LLTV goes away (Milestone 1A.6 already deletes the whitelist); strike replaces it. Oracle price is only read at settlement, not at maxDebt time.

#### Task 1B.1 — Add `strike` Field to `CollateralParams` Struct

**Files:** `contracts/src/interfaces/IAwakening.sol`

**Interfaces:**
- Consumes: existing `CollateralParams { token, lltv, maxLif, oracle }`
- Produces: `CollateralParams { token, oracle, strike }` — `lltv` and `maxLif` were deleted in Milestone 1A.6; `strike` is `uint256` denominated in loan-per-collateral scaled by `ORACLE_PRICE_SCALE` (1e36)

- [ ] **Step 1: Write failing test**
  ```solidity
  function test_market_id_changes_with_per_collateral_strike() public {
      CollateralParams[] memory a = _oneCollateral(BTC, oracleBTC, 100_000e36);
      CollateralParams[] memory b = _oneCollateral(BTC, oracleBTC,  80_000e36);
      bytes32 id1 = awakening.touchMarket(_makeMarket(a));
      bytes32 id2 = awakening.touchMarket(_makeMarket(b));
      assertTrue(id1 != id2, "different strikes must give different market ids");
  }
  ```
- [ ] **Step 2:** Add `uint256 strike;` to `CollateralParams` struct
- [ ] **Step 3:** Update every constructor callsite in tests. Use editor multi-cursor or a codemod.
- [ ] **Step 4:** `forge test test_market_id_changes_with_per_collateral_strike` → pass
- [ ] **Step 5: Commit**
  ```bash
  git commit -am "feat(strike): add per-collateral strike field to CollateralParams"
  ```

#### Task 1B.2 — Validate `strike` in `touchMarket`

- [ ] **Step 1: Write failing test**
  ```solidity
  function test_touchMarket_reverts_on_zero_strike_any_collateral() public {
      CollateralParams[] memory cp = new CollateralParams[](2);
      cp[0] = CollateralParams({token: BTC, oracle: oracleBTC, strike: 100_000e36});
      cp[1] = CollateralParams({token: ETH, oracle: oracleETH, strike: 0}); // bad
      vm.expectRevert(IAwakening.InvalidStrike.selector);
      awakening.touchMarket(_makeMarket(cp));
  }
  ```
- [ ] **Step 2:** Add `error InvalidStrike();` to `IAwakening.sol`; iterate `market.collateralParams` in `touchMarket`, revert on any `strike == 0`
- [ ] **Step 3:** Test pass. Commit.

#### Task 1B.3 — Rewrite `maxDebt` Calculation

**Files:** `contracts/src/Awakening.sol`

- [ ] **Step 1: Write failing test — maxDebt sums per-collateral strike × amount**
  ```solidity
  function test_maxDebt_sums_per_collateral() public {
      // Post 0.5 BTC (strike 100k) + 3 ETH (strike 3k)
      // Expected maxDebt = 0.5 × 100_000 + 3 × 3_000 = 59_000
      _supplyCollateral({idx: 0, amount: 0.5e18}); // BTC
      _supplyCollateral({idx: 1, amount: 3e18});   // ETH
      assertEq(awakening.maxDebt(id, borrower), 59_000e18);
  }
  ```
- [ ] **Step 2:** Rewrite `maxDebt(id, account)` to iterate `collateralBitmap`, sum `position.collateral[i] × collateralParams[i].strike / ORACLE_PRICE_SCALE`. **Do not call oracle** — strike is denominated in the loan asset already.
- [ ] **Step 3:** Test pass. Commit.
- [ ] **Step 4: Write invariant** — `debt ≤ maxDebt` always holds; add to Milestone 1D fuzz suite. Commit as `test(inv): position debt bounded by summed strike`.

#### Task 1B.4 — Confirm SSTORE2 Round-Trip Preserves New Field

- [ ] **Step 1:** Write test — store Market with 2-collateral params each with non-zero strike, read back via `IdLib`, assert equality
- [ ] **Step 2:** No code changes expected — `IdLib` uses `abi.encode(market)`, arrays with new field encode automatically
- [ ] **Step 3:** Commit test alone.

---

### Milestone 1C — PAT Interface & Reference Adapters

Define `IPAT` and ship two reference implementations.

#### Task 1C.1 — Define `IPAT` Interface

**Files:** `contracts/src/pat/IPAT.sol` (create)

**Interfaces produced:**
```solidity
interface IPAT {
    struct Terms {
        address underlying;   // collateral asset
        uint256 strike;       // in loan-per-collateral, scaled 1e36
        uint256 expiry;       // unix timestamp
        uint256 notional;     // collateral units covered
    }
    function terms(uint256 tokenId) external view returns (Terms memory);
    function isSettled(uint256 tokenId) external view returns (bool);
    function settle(uint256 tokenId) external returns (uint256 loanPayout);
    function attribute(uint256 tokenId, address market) external;
    function attributedTo(uint256 tokenId) external view returns (address);
}
```

- [ ] **Step 1:** Write the interface with full NatSpec
- [ ] **Step 2: Commit**
  ```bash
  git commit -am "feat(pat): define IPAT interface"
  ```

#### Task 1C.2 — Write `AttestedPAT` (Off-Chain, Deribit-Style)

**Files:** `contracts/src/pat/AttestedPAT.sol`, `contracts/test/pat/AttestedPAT.t.sol`

**Interfaces:**
- Consumes: `IPAT`
- Produces:
  - `mint(Terms terms, bytes signature)` — verifies custodian ECDSA over `keccak256(abi.encode(terms, nonce))`
  - `settle(tokenId)` — verifies attester signature over `(tokenId, terminalPrice)`, computes `max(strike - terminalPrice, 0) * notional`, pulls from custodian escrow

- [ ] **Step 1: Failing test — mint rejects bad signature**
  ```solidity
  function test_mint_reverts_on_wrong_signer() public {
      IPAT.Terms memory t = _defaultTerms();
      bytes memory badSig = _sign(t, bob_key);  // bob is not attester
      vm.expectRevert(AttestedPAT.InvalidAttestation.selector);
      pat.mint(t, badSig);
  }
  ```
- [ ] **Step 2:** Implement `mint` with `ECDSA.recover` check against stored `attester` address
- [ ] **Step 3:** Test pass. Commit.
- [ ] **Step 4:** Test — mint succeeds with valid signature, increments tokenId counter
- [ ] **Step 5:** Implement counter + `Terms` storage. Commit.
- [ ] **Step 6:** Test — `settle` pays `max(K-S, 0) * notional` at three prices: below / at / above strike
- [ ] **Step 7:** Implement `settle`. Requires terminal-price attestation from oracle role. Commit.
- [ ] **Step 8:** Test — `attribute` is one-shot (cannot re-attribute)
- [ ] **Step 9:** Implement `attribute`. Commit.

#### Task 1C.3 — Write `DerivePAT` (On-Chain Native, Full Integration)

**Files:** `contracts/src/pat/DerivePAT.sol`, `contracts/test/pat/DerivePAT.t.sol`, `contracts/test/mocks/MockDerive.sol`

Scope: full integration with Derive's option protocol on Lyra chain. Because we're on Sepolia and Derive is on Lyra, use a MockDerive that mirrors the real Derive ABI. When we go multichain, the wrapper contract changes; the interface stays.

- [ ] **Step 1:** Write `MockDerive.sol` matching Derive's `IOption` and `ISettlementFeed` ABIs (reference: [Derive docs — Options v2](https://docs.derive.xyz/reference/options)). Include `getOption(tokenId)`, `settle(tokenId)`, `getSettlementPrice(expiry)`.
- [ ] **Step 2:** Failing test — wrapping a MockDerive put position produces `Terms` matching the underlying Derive parameters
- [ ] **Step 3:** Implement `DerivePAT.wrap(deriveTokenId)` — reads Derive option params, verifies it's a PUT (not a call), mints internal PAT id
- [ ] **Step 4:** Failing test — `settle()` on wrapped PAT triggers Derive's own settle path and forwards proceeds
- [ ] **Step 5:** Implement `settle()` — delegates to Derive's `settle(tokenId)`, receives payout, forwards to caller. Commit.
- [ ] **Step 6:** Failing test — attempting to wrap a non-PUT option reverts with `NotAPut()`
- [ ] **Step 7:** Implement guard. Commit.
- [ ] **Step 8:** Failing test — attribution is one-shot (same as AttestedPAT)
- [ ] **Step 9:** Implement + commit.

#### Task 1C.4 — Write `ProtocolPAT` (Internal Writer Pool)

**Files:** `contracts/src/pat/ProtocolPAT.sol`, `contracts/test/pat/ProtocolPAT.t.sol`

**Purpose:** Fill gaps where neither Deribit nor Derive lists the required (strike, expiry) for an Awakening market. Hyperloop (or partnered market-makers) posts collateral to this pool and underwrites puts directly.

**Model:** each writer deposits loan-token collateral equal to `strike × notional` per underwritten PAT (i.e. writer pre-funds worst-case payout). Writer earns the premium (paid by maker at `mint` time in the take flow). If put expires OTM, writer withdraws collateral back; if ITM, collateral is drawn to fund `settle()`.

- [ ] **Step 1: Failing test — `deposit(loanToken, amount)` credits writer's balance**
- [ ] **Step 2:** Implement `deposit`. Commit.
- [ ] **Step 3: Failing test — `writePut(Terms terms, uint256 premium)` locks `strike × notional` of writer's balance, mints PAT, transfers premium to writer**
- [ ] **Step 4:** Implement `writePut`. Enforce `writer.available >= strike × notional`. Commit.
- [ ] **Step 5: Failing test — `settle()` after maturity, terminal price < strike, pays `(K-S) × notional` from writer's locked balance**
- [ ] **Step 6:** Implement `settle`. Requires oracle price feed. Commit.
- [ ] **Step 7: Failing test — writer can `withdraw()` only unlocked balance**
- [ ] **Step 8:** Implement + commit.
- [ ] **Step 9: Failing test — trying to `writePut` for a maturity Deribit or Derive would cover reverts with `ExternalCoverageAvailable`** (routing hint: writers should not undercut external venues)
- [ ] **Step 10:** Implement guard by checking an off-chain-provided "gap manifest" signed by protocol admin. Commit.

---

### Milestone 1D — Rewire `take()` for Per-Collateral PAT Attribution

Highest-risk change in the protocol. Move carefully.

With multi-collateral, the borrower's position may span N collateral types. `onBuy` returns an **array** of PAT attributions (length N ≥ 1), and every one must pass the 4 invariants against its matching `CollateralParams` index.

#### Task 1D.1 — Update `IBuyCallback.onBuy` Signature

**Files:** `contracts/src/interfaces/ICallbacks.sol`

**Signature change:**
```solidity
struct PATAttribution {
    uint8 collateralIndex;   // which CollateralParams[i] this PAT covers
    address pat;             // PAT contract
    uint256 patTokenId;      // PAT token id
}
// Old: onBuy(units, buyerAssets, data) returns (bytes32);
// New: onBuy(units, buyerAssets, data) returns (bytes32 magicValue, PATAttribution[] memory attributions);
```

- [ ] **Step 1:** Callback returning only magic value fails to compile. Adapt test mocks.
- [ ] **Step 2:** Modify interface; rebuild; fix compile errors.
- [ ] **Step 3:** Commit.

#### Task 1D.2 — Enforce 4 Per-Collateral PAT Invariants at Fill Time

**Files:** `contracts/src/Awakening.sol` — `take()` function, after `onBuy`

**Logic:** for each `PATAttribution a` returned by `onBuy`:
```solidity
CollateralParams memory cp = market.collateralParams[a.collateralIndex];
IPAT.Terms memory t = IPAT(a.pat).terms(a.patTokenId);
if (t.underlying != cp.token)                                                 revert PATUnderlyingMismatch();
if (t.strike != cp.strike)                                                    revert PATStrikeMismatch();
if (t.expiry < market.maturity || t.expiry > market.maturity + MAX_EXPIRY_TOLERANCE)  revert PATMaturityMismatch();
```
Then after all attributions processed, verify **per-collateral notional sufficiency**:
```solidity
for each active collateralIndex i in seller's position:
    uint256 required = position.collateral[i];  // one-to-one: 1 unit of collateral → 1 unit of PAT notional
    uint256 provided = Σ attributions[j].notional where attributions[j].collateralIndex == i;
    if (provided < required) revert PATNotionalInsufficient(i);
```

- [ ] **Step 1: Failing test — take reverts on strike mismatch for one collateral in a multi-collateral market**
  ```solidity
  function test_take_reverts_when_pat_strike_wrong_for_eth() public {
      // Market has BTC (strike 100k) and ETH (strike 3k). Borrower posts both.
      // Maker's callback returns valid BTC PAT but ETH PAT with strike 2k → mismatch.
      _prepareMakerCallbackWithMixedPATs({ethStrike: 2_000e36});
      vm.expectRevert(IAwakening.PATStrikeMismatch.selector);
      awakening.take(offer, ratifierData, units, taker, "");
  }
  ```
- [ ] **Step 2:** Add 4 errors: `PATUnderlyingMismatch`, `PATStrikeMismatch`, `PATMaturityMismatch`, `PATNotionalInsufficient(uint8 collateralIndex)`. Implement the loop above.
- [ ] **Step 3:** Test pass. Commit.
- [ ] **Step 4:** Repeat for the other three invariants — one failing test → one guard → one commit.
- [ ] **Step 5: Failing test — `PATNotionalInsufficient` fires when only one of two collateral types is covered.** Commit.

#### Task 1D.3 — Attribute Each PAT to Market at Fill

- [ ] **Step 1: Failing test — after multi-PAT take, every PAT is attributed to market address**
  ```solidity
  function test_take_attributes_all_pats_to_market() public {
      _successfulMultiCollateralTake();  // borrower posts BTC + ETH
      assertEq(btcPat.attributedTo(btcTokenId), address(awakening));
      assertEq(ethPat.attributedTo(ethTokenId), address(awakening));
  }
  ```
- [ ] **Step 2:** In `take()`, after invariant checks, iterate attributions and call `IPAT(a.pat).attribute(a.patTokenId, address(this))` for each. Store per-collateral mapping `attributedPATs[marketId][collateralIndex]` (append-only list).
- [ ] **Step 3:** Emit `PATAttributed(marketId, collateralIndex, pat, tokenId, notional)` per attribution. Commit.

#### Task 1D.4 — Fuzz + Invariant Tests

- [ ] **Step 1:** Add per-collateral invariant
  ```solidity
  function invariant_credit_bounded_by_per_collateral_strike() public {
      uint256 totalMaxDebt = 0;
      uint128 bitmap = position.collateralBitmap;
      while (bitmap != 0) {
          uint256 i = _msb(bitmap);
          totalMaxDebt += position.collateral[i] * market.collateralParams[i].strike / ORACLE_PRICE_SCALE;
          bitmap = _clearBit(bitmap, i);
      }
      assertLe(position.debt, totalMaxDebt);
  }
  ```
- [ ] **Step 2:** Add PAT coverage invariant
  ```solidity
  function invariant_per_collateral_pat_covers_collateral() public {
      // For each active collateral i in every position, Σ attributed PAT notional
      // for that (market, i) ≥ total collateral of type i posted in that market.
      for each collateralIndex i active in market:
          uint256 collateralPosted = _totalCollateralOfType(id, i);
          uint256 patNotionalAttributed = _sumAttributedPATNotional(id, i);
          assertGe(patNotionalAttributed, collateralPosted);
  }
  ```
- [ ] **Step 3:** `forge test --match-test invariant_ -vv` for 10k runs
- [ ] **Step 4:** Fix any counter-examples. Commit.

---

### Milestone 1E — Settlement Contract

New contract `AwakeningSettlement.sol` — the "close the market" logic.

**States:** `PRE_MATURITY → ORACLE_READ → PAT_REDEEMED → REPAY_WINDOW_OPEN → REPAY_WINDOW_CLOSED → FINAL`

#### Task 1E.1 — Skeleton + State Machine

**Files:** `contracts/src/settlement/AwakeningSettlement.sol` (create)

- [ ] **Step 1:** State-transition tests — one per illegal transition (e.g., cannot call `redeemPATs` before `readOracle`)
- [ ] **Step 2:** Implement state enum + `modifier onlyInState(State s)`. Commit each transition.

#### Task 1E.2 — `readOracleAtMaturity`

- [ ] **Step 1:** Failing test — reverts if called before maturity
- [ ] **Step 2:** Implement. Store `terminalPrice`. Emit `TerminalPriceRead(id, price, blockTimestamp)`
- [ ] **Step 3:** Failing test — cannot be called twice. Enforce state transition.
- [ ] **Step 4:** Commit each.

#### Task 1E.3 — `redeemPATs`

- [ ] **Step 1:** Failing test — after redeem, contract holds `sum(max(K-S, 0) * notional)` in loan tokens
- [ ] **Step 2:** Iterate over attributed PATs, call `IPAT.settle()` on each. Track total received.
- [ ] **Step 3:** Failing test — partial PAT failure emits `PATSourceShortfall` event, transitions to `SHORTFALL` sub-state
- [ ] **Step 4:** Implement try/catch around each `settle()` call. Commit.

#### Task 1E.4 — Repayment Window (Default 24h)

- [ ] **Step 1:** Failing test — borrower can repay debt in loan tokens and get collateral back, only during window
- [ ] **Step 2:** Implement `repay(units)`. Deduct debt, increment `withdrawable`, return collateral. Commit.

#### Task 1E.5 — Collateral Disposition After Window

- [ ] **Step 1:** Failing test — after window, unclaimed collateral satisfies lenders per identity `min(S,K) + max(K-S,0) = K`
- [ ] **Step 2:** Implement `finalize()`. Combine remaining collateral value + PAT proceeds. Each credit unit redeemable for 1 loan token via `withdraw()`
- [ ] **Step 3:** Surplus goes to `surplusRole` address (set at market creation). Commit.

#### Task 1E.6 — Wire Settlement Address into Market

- [ ] **Step 1:** Update Market struct to include `address settlement`
- [ ] **Step 2:** In `take()`, verify `market.settlement` is a deployed contract implementing `IAwakeningSettlement`. Commit.

---

### Milestone 1F — Fee Tweaks & Cleanup

#### Task 1F.1 — PAT Attribution Fee (Bounded 5% of Premium)

- [ ] Add `MAX_PAT_ATTRIBUTION_FEE = 5e16` (5% in WAD) to `ConstantsLib`
- [ ] Add per-market `patAttributionFee` bounded by MAX
- [ ] In `take()`, after PAT attribution, deduct `fee = premium * patAttributionFee / WAD` in loan tokens from maker; route to `feeRecipient`
- [ ] Test + commit

#### Task 1F.2 — Final Grep Sweep

- [ ] `grep -rn 'Midnight\|midnight\|MIDNIGHT' contracts/src contracts/test` returns nothing
- [ ] `grep -rn 'liquidat\|LLTV\|LIF\|RCF\|lossFactor\|isHealthy' contracts/src` returns nothing
- [ ] Update contracts `README.md` if it still mentions Midnight

---

### Milestone 1G — Test Coverage & Certora

#### Task 1G.1 — Coverage

- [ ] `forge coverage --report lcov` → open in browser
- [ ] Every uncovered branch gets a test
- [ ] Target: 95% line, 90% branch

#### Task 1G.2 — Adapted Certora Specs

- [ ] **Delete:** `certora/confs/Liquidate.conf`, `LossFactor.conf`, `Healthiness.conf`, `LiquidationBoundedByLIF.conf`, `LiquidationProfitability.conf`, `NoDebtWithoutCollateral*.conf`, `PostMaturityDebt.conf`, `SplitDoesNotPunishMakerOrFavorTaker.conf`
- [ ] **Create:** `certora/confs/PATInvariant.conf` proving `sum(credit_at_maturity) ≤ sum(K * pat_notional / 1e36)`
- [ ] **Create:** `certora/confs/NoOracleReadBeforeMaturity.conf`
- [ ] Run `certoraRun` on each remaining conf. Fix violations.

#### Task 1G.3 — Phase 1 Exit Review

- [ ] Invoke `superpowers:requesting-code-review` with target: entire `contracts/src/` after Phase 1
- [ ] Address every reviewer comment
- [ ] Ship draft audit PR to Spearbit / Blackthorn / TrustSec — extend the 3 inherited audits with the delta

---

## Phase 2 — Backend (Java + Spring Boot)

Runs in parallel starting when Milestone 1D lands (ABI stable enough).

Milestones:
- **2A** — Skeleton
- **2B** — Chain Indexer
- **2C** — Offer Relay
- **2D** — PAT Source Adapters (Deribit + Derive + Internal Pool)
- **2E** — Tiered Router API

---

### Milestone 2A — Skeleton

#### Task 2A.1 — Bootstrap Spring Boot Project

**Files:** `backend/pom.xml`, `backend/src/main/java/xyz/hyperloop/awakening/Application.java`

- [ ] **Step 1:** `spring init --dependencies=web,data-jpa,flyway,postgresql,validation --java-version=21 --build=maven backend/`
- [ ] **Step 2:** Add web3j 4.12+ dependency
- [ ] **Step 3:** Verify `mvn spring-boot:run` starts on :8080
- [ ] **Step 4:** Commit

#### Task 2A.2 — Local Postgres + Flyway Migration V1

- [ ] **Step 1:** Add `ops/docker-compose.yml` with Postgres 16 + anvil (local Ethereum RPC)
- [ ] **Step 2:** Write `V1__initial_schema.sql` — tables: `markets`, `offers`, `takes`, `pat_attributions`, `positions`, `settlements`
- [ ] **Step 3:** `mvn flyway:migrate` — schema applies
- [ ] **Step 4:** Commit

#### Task 2A.3 — Generate web3j Bindings from ABI

- [ ] **Step 1:** `forge build --extra-output abi` in contracts, copy ABIs to `backend/src/main/resources/abi/`
- [ ] **Step 2:** Use `web3j-cli`: `web3j generate solidity -a Awakening.abi -o backend/src/main/java -p xyz.hyperloop.awakening.contracts`
- [ ] **Step 3:** Add Maven plugin to regenerate on ABI change
- [ ] **Step 4:** Commit

#### Task 2A.4 — Milestone 2A Retro — Go/No-Go on Java

- [ ] Retro against §0.3 exit criterion
- [ ] Document decision in `docs/decisions/002-backend-language.md`

---

### Milestone 2B — Chain Indexer

#### Task 2B.1 — Event Subscription Service

- [ ] Subscribe to `MarketCreated`, `Take`, `PATAttributed`, `SettlementExecuted`, `Repay`, `WithdrawCollateral` via web3j `flowable()`
- [ ] Persist raw event log + decoded fields to Postgres (`events` table, JSONB payload)
- [ ] Reorg handling: track `confirmations >= 12` before considering "final"

#### Task 2B.2 — Materialized Views

- [ ] Aggregation service: events → `positions` and `markets` tables (materialized views refreshed every 5s)

#### Task 2B.3 — Backfill

- [ ] CLI: `mvn exec:java -Dexec.mainClass=...Backfill -Dblock.from=X` — replays from genesis or given block

---

### Milestone 2C — Offer Relay

Off-chain offer storage & query. Offers are signed by makers off-chain; the relay stores them and serves them to takers/routers.

#### Task 2C.1 — REST Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/offers` | Body: full Offer + signature. Verify sig, store. |
| `GET` | `/api/v1/offers?market={id}&side={buy\|sell}` | Return active offers, sorted by price. |
| `DELETE` | `/api/v1/offers/{root}` | Maker cancels a Merkle root. |

#### Task 2C.2 — Merkle Offer Bundles

- [ ] `POST /api/v1/offer-bundles` — maker submits Merkle root + list of leaves. Store leaves; client requests proof for any leaf.

---

### Milestone 2D — PAT Source Adapters

Three independent sub-services, one per PAT source. Each exposes: (a) inventory query — "does this source have puts at (strike, expiry, notional) for this collateral?", (b) commit — "produce something the on-chain `IPAT.mint()` will accept."

#### Task 2D.1 — Deribit Adapter (primary liquidity)

- [ ] Deribit API client: poll `/private/get_positions` for maker's held put positions (per-maker API keys held in KMS)
- [ ] Cross-check with custodian's signed attestation feed (Coinbase Custody Deribit account or equivalent)
- [ ] `GET /api/v1/attestations/deribit?maker=X&collateral=BTC&strike=Y&expiry=Z&notional=N` returns ECDSA signature over `keccak256(abi.encode(terms, nonce))` matching `AttestedPAT.mint()`
- [ ] Attester private key in AWS KMS. **Never in code, never in env vars.**
- [ ] Metric: attestations issued per hour, per-maker failure rate, custodian feed staleness

#### Task 2D.2 — Derive Adapter (trustless fallback)

- [ ] Derive Lyra L2 RPC connection (separate from Sepolia)
- [ ] `GET /api/v1/inventory/derive?collateral=BTC&strike=Y&expiry=Z` returns list of open Derive put tokens matching, with owner + notional
- [ ] For maker convenience: `POST /api/v1/derive/wrap-tx` returns unsigned tx bytes that call `DerivePAT.wrap(deriveTokenId)` on Sepolia — maker signs and submits
- [ ] No secrets required; Derive positions are publicly readable

#### Task 2D.3 — Internal Writer Pool Adapter (gap-filler)

- [ ] Postgres table `writer_pool_positions` — off-chain ledger of `(writer, collateral, strike, expiry, notional, locked, premium)`
- [ ] `GET /api/v1/inventory/internal?collateral=BTC&strike=Y&expiry=Z&notional=N` returns available writers and their price quotes
- [ ] `POST /api/v1/internal/write` — signs a request that a maker submits to `ProtocolPAT.writePut(terms, premium)`
- [ ] "Gap manifest" service: emits a signed manifest of `(collateral, strike, expiry)` tuples where Deribit AND Derive have no listing — required by `ProtocolPAT` to prevent competing with external venues
- [ ] Alert if writer pool utilization > 80% (early warning for capital top-up)

#### Task 2D.4 — Attestation Service Health Dashboard

- [ ] `/api/v1/health/pat-sources` returns per-source: alive, attestations/hour, notional attributed today, latest error
- [ ] Frontend Portfolio page reads this to show green/yellow/red indicator per PAT source (referenced in Screen 4)

---

### Milestone 2E — Tiered Router API

Router chooses across three PAT sources per fill. Preference order (configurable per market via `patGate`): **Deribit → Derive → Internal**. Router batches PATs per collateral index for multi-collateral fills.

#### Task 2E.1 — Inventory Aggregator

- [ ] `GET /api/v1/inventory?collateral=BTC&strike=Y&expiry=Z&notional=N` aggregates across all three adapters; returns tiered list
- [ ] Cache 30s; invalidate on `PATAttributed` event

#### Task 2E.2 — Best-Fill Endpoint

- [ ] `GET /api/v1/route?market={id}&side={buy|sell}&amount={x}` returns:
  - Ordered list of offers to consume
  - **Per-collateral PAT plan:** for each active collateral index in the resulting position, which source(s) will attribute PATs and in what notional split
  - Required attestations pre-fetched (Deribit signatures inlined; Derive `wrap` calldata; internal pool signatures)
  - Final calldata for `AwakeningBundles.multicall` — one atomic tx
- [ ] Consider: gas cost, consumption groups, PAT notional remaining per source, source preference order

#### Task 2E.3 — Fallback Logic

- [ ] If a maker's chosen PAT source is depleted at fill time, router auto-shifts to next tier (fires event `PATSourceFallback` for observability)
- [ ] If all three sources exhausted, `/api/v1/route` returns HTTP 503 with `Retry-After` and a hint at which strike/expiry would be fillable

---

## Phase 3 — Frontend (Next.js)

Starts after ABI stable + backend Milestone 2C.

### UX Design — 4 Core Screens

#### Screen 1 — Markets (`/markets`)

- Grid of market cards. Each card: collateral logo, loan asset, maturity countdown, strike (as % of spot), best borrow rate, best lend rate, PAT-source badge
- Filters: collateral (BTC/ETH), maturity bucket (< 30d / 30–90d / > 90d), PAT source (Deribit-attested / Derive on-chain)
- Empty state: "No markets yet. Be the first to create one." + link to `/markets/create`

#### Screen 2 — Borrow (`/borrow/[marketId]`)

- **Left panel:** market summary (strike, maturity, collateral required, put source)
- **Right panel:** form
  - Input: collateral amount (with USD equiv from oracle)
  - Computed: max loan (= strike × collateral), rate (from best offers), fees, all-in cost
  - Button: "Preview borrow" → shows tx breakdown (approve + supplyCollateral + take, atomic via AwakeningBundles) → "Sign transaction"
- **Post-tx:** position card with countdown to maturity, "you owe X USDC at T_M"

#### Screen 3 — Lend (`/lend/[marketId]`)

- Symmetric to Borrow. Input loan amount, computed rate, tx preview, post-tx position card
- Emphasize non-liquidative story: "Your principal is backed by a put on X BTC at K, expiring T_M"

#### Screen 4 — Portfolio (`/portfolio`)

- All open positions (borrow + lend)
- **Each borrow:** countdown, "Repay early" button (if buy offers available), rate paid
- **Each lend:** countdown, projected payoff, PAT source health indicator (green/yellow/red based on attestation freshness)
- **Post-maturity:** "Repay" or "Claim" buttons active for 24h window

---

### Milestone 3A — Scaffold

- [ ] `pnpm create next-app frontend --typescript --tailwind --app`
- [ ] Add: wagmi v2, viem, RainbowKit, @tanstack/react-query, shadcn/ui
- [ ] Configure providers in `app/layout.tsx`; include Sepolia chain config
- [ ] `.env.local`: backend API URL, WalletConnect project ID

### Milestone 3B — Markets Page

- [ ] Route: `app/markets/page.tsx`. Server component fetches `/api/v1/markets`
- [ ] Card component (shadcn `Card`) with market fields
- [ ] Client-side filters (URL-synced via `nuqs`)
- [ ] Empty + loading + error states
- [ ] Playwright: `e2e/markets.spec.ts` — asserts N cards render for N seeded markets

### Milestone 3C — Borrow Flow

- [ ] Route: `app/borrow/[marketId]/page.tsx`
- [ ] Form: react-hook-form + zod validation
- [ ] Rate quote: `useRateQuote(marketId, amount)` hook, debounced 300ms, calls `/api/v1/route`
- [ ] Transaction: `useSimulateContract` + `useWriteContract`. On success, refetch portfolio.
- [ ] Toast notifications (sonner) for tx status
- [ ] Playwright: full flow on Sepolia against local anvil fork

### Milestone 3D — Lend Flow

- [ ] Same structure as Borrow, adapted for lender side

### Milestone 3E — Portfolio

- [ ] Route: `app/portfolio/page.tsx`
- [ ] Live position data via `useReadContracts` (multicall)
- [ ] Countdown timers
- [ ] Repay button (opens modal → approve USDC + call `AwakeningSettlement.repay`)
- [ ] Playwright: open borrow → repay → collateral returned

---

### Integration Contract (Frontend ↔ Backend ↔ Chain)

| Data | Source | Rationale |
|---|---|---|
| User's own position, allowances, current block, ETH balance | **Chain** (`useReadContract`) | Must be current & trustless |
| Market list, offer books, PAT attestations, historical rates | **Backend** (cached, chain is ground truth) | Sortable, queryable in Postgres |
| All writes | **Chain** (user signs) | Backend never signs on behalf of user |
| Service messages (attestations, offer-relay auth) | **Backend** (backend signs) | These are backend's own data |
| Router calldata | Backend computes; frontend submits | Frontend gets ABI-encoded calldata + PAT proof, submits as one `AwakeningBundles.multicall`. User signs one thing. |

---

## Phase 4 — Testing & Acceptance

Rolling throughout; formal gate before Sepolia launch.

---

### Contract Acceptance Checklist

- [ ] `forge test` all green
- [ ] `forge coverage`: ≥ 95% line, ≥ 90% branch on `src/`
- [ ] `forge test --match-test invariant_ --runs 100000` passes
- [ ] All Certora specs pass
- [ ] `slither src/ --exclude-dependencies` returns no High/Medium
- [ ] Gas snapshot within 20% of Midnight baseline for `take()`, `withdraw()`, `repay()`
- [ ] At least one audit firm signed off on the PAT-layer delta
- [ ] `superpowers:receiving-code-review` completed for all reviewer comments

### Backend Acceptance Checklist

- [ ] All service integration tests pass with Testcontainers Postgres
- [ ] Indexer replays Sepolia's full Awakening history in < 10 minutes
- [ ] Load test (k6 or Gatling): 100 rps on `/api/v1/route` for 5 minutes, p99 < 500ms
- [ ] Chaos test: kill Postgres mid-indexing → indexer resumes cleanly on restart

### Frontend Acceptance Checklist

- [ ] Playwright e2e covers: connect wallet → view markets → borrow → repay → collateral returned. Green in CI.
- [ ] Lighthouse mobile score ≥ 85 on Markets and Portfolio
- [ ] All amounts displayed with correct decimals, currency symbol, USD equivalent
- [ ] Every transaction has a preview before signing showing: contract, function, decoded args, gas estimate
- [ ] Rejected-signature and reverted-tx paths show useful error messages (not raw hex)

### Alpha Launch Checklist (Sepolia)

- [ ] Deploy contracts to Sepolia via `ops/deploy/sepolia.sh` (Foundry script)
- [ ] Seed 5 markets: BTC/USDC at strikes 90k/100k/110k, maturities 30d/60d/90d
- [ ] Fund maker EOA with test loan tokens; publish 20 offers via offer-relay
- [ ] Mock Deribit attester signs test PATs
- [ ] Publish `alpha.awakening.hyperloop-fi.xyz`
- [ ] Recruit 10 external testers (crypto-native friends + one institutional contact)
- [ ] Track: bug count by severity, gas per tx (avg), time-to-first-borrow per user
- [ ] Post-alpha retro: decide v0.2 scope (mainnet? call-attribution zero-coupon collar? strike-rolling markets?)

---

## Appendix A — Worktree Recommendation

**TL;DR: No workspace-level worktree. Yes to per-milestone feature branches.**

The Awakening/ folder is already an isolated git repo. Nesting another worktree at the workspace level adds no isolation — it just adds a directory. The isolation you want is *between features*, not between "this project and other Hyperloop stuff."

### When TO use worktrees inside `Awakening/`

1. **Milestones 1A → 1B → 1C.** These modify the same Solidity files heavily. If you want to keep the "purged" branch stable while exploring PAT designs in parallel:
   ```bash
   cd Awakening
   git worktree add ../Awakening-pat-explore feat/pat-design
   ```
   Use for spike work; delete when merged.

2. **Certora runs are slow (5–30 min).** If you want to code while Certora runs on another branch, worktree the running-Certora branch so your editor state on the main branch is untouched.

3. **Audit-response branches.** When Spearbit sends back findings, work on `feat/audit-spearbit-response` in a worktree — you may need multiple audit-response branches alive in parallel.

### When NOT to use worktrees

- Pure documentation edits (this file, README, ADRs)
- Frontend/backend work that doesn't touch contracts. Those directories are separate; branch churn there doesn't affect contracts.
- Anything that finishes in < 1 day

### Enforcement

Add to `docs/CONTRIBUTING.md`: *"Any PR touching `contracts/src/Awakening.sol` or files > 100 LOC change: use a worktree."*

---

## Appendix B — Decisions Log

Resolved 2026-08-01 in conversation.

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Multi-collateral in v0.1? | **Keep full Midnight multi-collateral** (up to 128 per market). Each `CollateralParams` gets its own strike. | Institutional buyers expect real product surface. Simplification savings would have cost a v0.2 refactor. |
| 2 | Which PAT source(s) at launch? | **All three, tiered:** Deribit primary → Derive fallback → Internal writer pool for gaps | Deribit gives BTC/ETH depth for institutions; Derive gives trustless option; internal pool covers non-standard strikes. |
| 3 | Repayment window | **Hardcoded 24h** | Simpler contract state; per-market override deferred to v0.2. |
| 4 | Sepolia oracle | **Chainlink Sepolia BTC/USD; 30-min TWAP at maturity** | Anti-manipulation over single-block cost is affordable. |
| 5 | Frontend deployment | **Vercel** | Native Next.js support, preview URLs, zero-config. Egress cost is not v0.1's problem. |
| 6 | Contract audit budget | **Deferred — revisit at Phase 1G exit** | Scope of the delta over Midnight is not yet knowable; budgeting audit now is premature. Post-Phase 1G re-scoping will determine Spearbit-only extension vs. new full audit vs. dual audit. |

**Note on Q6:** Sepolia alpha does *not* require the extended audit. The audit decision blocks mainnet only. Track this in `docs/decisions/003-audit-scope.md` when Phase 1G completes.

---

# 中文版

## 目录

1. Header — 目标 · 架构 · 技术栈
2. 全局约束
3. Phase 0 — 工作区与基础规则
4. Phase 1 — 合约
5. Phase 2 — 后端
6. Phase 3 — 前端
7. Phase 4 — 测试与验收
8. 附录 A — Worktree 建议
9. 附录 B — 待定决策

---

## Header

| 字段 | 值 |
|---|---|
| **目标** | 发布 Awakening v0.1 —— 一个非清算式、固定利率、固定到期的 EVM BTC 借贷协议 —— 作为完整系统(合约 + 后端 + 前端),在 Sepolia 测试网上以真实 Deribit 见证 PAT 跑通完整"借 → 还"生命周期。 |
| **架构** | 基于 Morpho Midnight;删除全部清算面;加一层 Put Attribution Token (PAT),由 maker 在成交时同步交付。链下服务(Java 索引器 + offer 中继 + PAT 见证)夹在链与 Next.js 前端之间。Oracle 在市场生命周期里**只读一次**,在到期时。 |
| **合约** | Solidity 0.8.x · Foundry · Certora |
| **后端** | Java 21 · Spring Boot 3 · PostgreSQL 16 · Flyway · web3j |
| **前端** | Next.js 15 (App Router) · TypeScript · wagmi v2 · viem · RainbowKit · Tailwind · shadcn/ui |
| **基础设施** | Docker Compose (本地) · Fly.io / Render (后端) · Vercel (前端) · Sepolia (v0.1 测试网) |

---

## 全局约束

每一个任务都隐含继承本节。复制到任何 subagent 任务简报的开头。

| # | 规则 |
|---|---|
| G1 | **不动** `研究/白皮书 & Deck/code/` 里的 Midnight 源码。只改 `Awakening`。 |
| G2 | **改名纪律:** `Midnight → Awakening` 只做一次(Task 0.3),不散在各 feature commit 里。 |
| G3 | **清算逻辑必须彻底根除。** Phase 1 结束后:`grep -rn 'liquidat\|LLTV\|LIF\|lossFactor\|isHealthy' contracts/src/` 必须返回空。 |
| G4 | **Oracle 每个市场读 ≤ 1 次。** 到期前任何一处读 oracle 都是 bug。 |
| G5 | **Solidity 版本**锁定为 Midnight 的 `foundry.toml` 版本。v0.1 不升级。 |
| G6 | **提交粒度:** 一个绿测试 = 一个提交。永远不批量提交不相关改动。 |
| G7 | **覆盖率下限:** Phase 1 收尾前 `contracts/src/` 行覆盖 ≥ 95%、分支覆盖 ≥ 90%。 |
| G8 | **后端语言:** Java 21。退出条款见 §0.3。 |
| G9 | **钱包优先 UX:** 用户每一个动作都必须在签名前有可读的交易预览。 |
| G10 | **所有 PR 走 review 合并。** Task 0.3 后禁止直接推 `main`。 |

### 0.1 最终仓库结构

见英文版 0.1 节的目录树。中文注释版:

- `contracts/` — Foundry 项目(基于 Midnight,清算已删、PAT 已加)
  - `src/Awakening.sol` — 从 `Midnight.sol` 改名,约 700 行
  - `src/settlement/AwakeningSettlement.sol` — 新增,约 250 行
  - `src/pat/` — PAT 抽象与两个参考实现
  - `src/{interfaces,libraries,ratifiers,periphery}/` — 大部分复用
- `backend/` — Java 21 + Spring Boot 3
  - `indexer/` — 链上事件 → Postgres
  - `offer-relay/` — 链下 offer 发布 + 查询
  - `attestation/` — Deribit 签名验证与见证 feed
  - `router/` — 撮合路径计算
- `frontend/` — Next.js 15 App Router,四个页面 markets/borrow/lend/portfolio
- `ops/` — Docker Compose + 部署脚本
- `audits/` — 外部审计报告
- `docs/` — 架构文档

### 0.2 范围 —— v0.1 与延后

**v0.1(本 plan)—— 2026-08-01 确认**

- **多抵押市场**(每 market 最多 128 种,沿用 Midnight)。每个 `CollateralParams` 有自己的 strike、oracle、PAT 需求
- **三个 PAT 源,分层使用:**
  1. **Deribit 链下见证** —— BTC/ETH put 的主流动性
  2. **Derive 链上原生** —— 无信任兜底,Derive 上市的 strike/expiry 走它
  3. **协议内 writer pool** —— 前两者未覆盖的 (strike, expiry) 由 Hyperloop 或合作 MM 直接承接
- 只 Sepolia 测试网,不上主网
- 只英文 UI
- 每个(collateral-set, loan, maturity, strike-set)对应一个 market;市场间不跨保证金

> **多抵押 + 分层 PAT 的设计后果:**
> 借款人若上多种抵押(如 0.5 BTC + 3 ETH),maker 的 `onBuy` callback 必须返回**数组** PAT attribution,每种抵押类型一个。外部venue 不卖篮子 PAT,所以我们不合成。每个 PAT 挂在特定的 `CollateralParams` index 上。不变量变为**每 index**校验(见 Milestone 1D)。

### 0.3 Java 后端的取舍 —— 显式决策记录

**决策:** 后端用 Java 21 + Spring Boot 3。

**理由:** Troy 正在学 Java。学习价值 > 生态契合度(对于一个 solo-founder 主导的 v0.1)。

**接受的代价**

1. web3j 更新速度慢于 viem/ethers.js —— 新 EIP 可能滞后 3-6 个月
2. 与前端(TS)不共享类型。建议:OpenAPI schema → TS typegen
3. 索引器模板少(Ponder / Envio / Subsquid / Goldsky 都是 TS/Rust)。预计比用 Ponder 多花时间
4. 未来招人:crypto 后端工程师几乎都偏 Node/Rust

**退出条款:** 如果到 Milestone 2A 结束时(骨架 + 首个事件被索引),每日感受到的效率损失 > 30%,切换到 Node + TypeScript。**Milestone 2C 之后不允许再切。**

**不接受的:** Java 用于前端或链上代码。合约永远 Solidity;前端永远 TypeScript。

### 0.4 工作顺序与理由

`合约 → 后端 → 前端`,略有重叠:

1. **合约优先。** 定义所有下游消费的 ABI。是发布的最长路径,也最吃审计。
2. **后端在 Milestone 1D 完成后开始。** 此时 ABI 已经 80% 稳定。
3. **前端在 Milestone 1E 完成 + 后端 Milestone 2C 完成后开始。** 需要稳定的 ABI 和可用的后端 API。

这**不是**理论上最快的顺序。这是最安全的 —— 审计尾巴最长的部分(合约)对其他部分的依赖最少。

### 0.5 测试哲学

| 层 | 方式 |
|---|---|
| **合约** | 严格 TDD。Foundry 单元 + invariant + fuzz。Certora 做形式化。 |
| **后端** | 状态变更 handler 用 test-first。用 Testcontainers 跑 Postgres。集成测试 > 单元测试。 |
| **前端** | Playwright e2e > 单元。组件测试只用于纯 UI 逻辑(格式化、hooks)。 |
| **CI** | 提交的测试文件里禁止 `skip` / `only`。`main` 上所有 check 必须绿。 |

### 0.6 头脑风暴闸门

开始 Phase 1 前:如果这个 plan 里任何一部分让你觉得不对 —— 技术栈选型、范围裁剪、PAT 源选择 —— 用 `superpowers:brainstorming` 重开这个问题。**不要**咬牙执行你不认同的 plan。

---

## Phase 0 — 工作区与基础规则

把仓库带到一个已知的干净基线,再动业务逻辑。

### Task 0.1 — 确认基线可构建

**文件:** `contracts/foundry.toml`、`contracts/lib/`

- [ ] **Step 1: 安装 foundry + 依赖**
  ```bash
  cd Awakening/contracts
  forge install
  ```
- [ ] **Step 2: 基线构建** —— `forge build` 应该干净通过
- [ ] **Step 3: 基线测试**
  ```bash
  forge test --gas-report | tee ../ops/baseline-test-report.txt
  ```
  所有 Midnight 测试应通过。保存报告 —— 之后哪些可以破、哪些必须保,以此为准。
- [ ] **Step 4: 提交**
  ```bash
  git commit -am "chore: capture baseline Midnight test output"
  ```

### Task 0.2 — 分支策略与保护

- [ ] 建立 `main` 分支保护(禁止直推,PR + 1 review + CI 绿)
- [ ] 建 `feat/awakening-purge-liquidation` 分支给 Milestone 1A
- [ ] 在 `docs/CONTRIBUTING.md` 记录分支策略(15 行内)

### Task 0.3 — 大批量、机械改名 Midnight → Awakening

**文件:** `contracts/src/**/*.sol`、`contracts/test/**/*.sol`、`contracts/foundry.toml`、`contracts/README.md`

- [ ] **Step 1: 改文件名**
  ```bash
  git mv contracts/src/Midnight.sol contracts/src/Awakening.sol
  git mv contracts/src/interfaces/IMidnight.sol contracts/src/interfaces/IAwakening.sol
  git mv contracts/src/periphery/MidnightBundles.sol contracts/src/periphery/AwakeningBundles.sol
  ```
- [ ] **Step 2: 搜索替换标识符**(见英文版)
- [ ] **Step 3:** 把 `CALLBACK_SUCCESS` 魔法字符串 `"morpho.midnight.callbackSuccess"` 改为 `"hyperloop.awakening.callbackSuccess"`
- [ ] **Step 4:** `forge build && forge test` 应仍全绿(改名是机械操作)
- [ ] **Step 5: 提交** `git commit -am "refactor: rename Midnight → Awakening across sources and tests"`

### Task 0.4 — 验证 Certora 规范可跑(可选)

- [ ] 装 Certora CLI,取 access key
- [ ] 跑一个 spec 端到端:`certoraRun certora/confs/Bitmap.conf`
- [ ] 通过 → 好。因改名失败 → 更新 spec 里的合约引用。

---

## Phase 1 — 合约

**参考:** `docs/midnight-架构详解.md` §5.1 是权威变更清单。本阶段就是逐任务实现它。

Milestones:
- **1A** — 清算面清除
- **1B** — 加 strike 与 maturity 纪律
- **1C** — PAT 接口与参考适配器
- **1D** — 改造 `take()` 挂上 PAT attribution
- **1E** — Settlement 合约
- **1F** — 费用调整与收尾
- **1G** — 测试覆盖与 Certora

### Milestone 1A — 清算面清除

把 Awakening.sol 里所有清算痕迹删掉。引用清算的测试**删掉**,不 skip。

#### Task 1A.1 — 删除 `ILiquidateCallback` + `ILiquidatorGate`

- [ ] 写一个失败测试(元测试,断言 grep 无匹配)
- [ ] 删除 `ICallbacks.sol` 里的 `ILiquidateCallback`;删除 `IGate.sol` 里的 `ILiquidatorGate`
- [ ] `forge build` 会在所有 import 处报错 —— 删除这些 import
- [ ] 加 CI 检查:`! grep -rn 'ILiquidateCallback\|ILiquidatorGate\|liquidate(' src/`
- [ ] 提交 `feat(purge): remove ILiquidateCallback and ILiquidatorGate`

#### Task 1A.2 — 删除 `liquidate()` 函数

- [ ] 写失败测试:断言 `liquidate` selector 不存在
- [ ] 删除函数以及所有私有 `_liquidate*` 辅助函数
- [ ] 提交 `feat(purge): delete liquidate() function and helpers`

#### Task 1A.3 — 删除清算相关测试

- [ ] `find contracts/test -iname '*liquidat*'` 逐个审查
- [ ] 纯清算的删,混合的把非清算测试抽到新文件后删原文件
- [ ] `forge test` 绿
- [ ] 提交 `test(purge): remove liquidation-only test files`

#### Task 1A.4 — 删除 slashing (`lossFactor`) 机制

- [ ] 写失败测试:`MarketState` 里没有 `lossFactor` 字段
- [ ] 从 `MarketState` struct 删 `lossFactor`
- [ ] 从 `Position` struct 删 `lastLossFactor`
- [ ] 删 `Awakening.sol` 里所有引用;`_updatePosition` 简化
- [ ] `forge build && forge test` 绿
- [ ] 提交 `feat(purge): remove lossFactor slashing (no bad debt in Awakening)`

#### Task 1A.5 — 删除 `isHealthy` 与所有 health-check 调用

- [ ] 写失败测试:借款人可以在有 debt 时取 collateral(此时会**临时**破坏不变量,由 1E 修)
- [ ] 删 `isHealthy` 和所有调用点
- [ ] 在 `Awakening.sol` 顶部加 TODO 注释:"collateral 未锁,由 Milestone 1E 通过 PAT 锁定"
- [ ] `forge test` 接受临时破坏;失败测试打注释 `// TODO: Milestone 1E — collateral lock`
- [ ] 提交 `feat(purge): remove isHealthy checks (temp: unlocked collateral until 1E)`

#### Task 1A.6 — 删除 `LIQUIDATION_LOCK` + LIF/RCF/LLTV

- [ ] 删 `LIQUIDATION_LOCK_SLOT`、`LLTV_0..8`、`TIME_TO_MAX_LIF`、`LIQUIDATION_CURSOR_*`、`isLltvAllowed`、`maxLif`
- [ ] Grep 每个常量,删除所有引用
- [ ] 若 `tExchange`/`tGet` 只被 liquidation lock 用,一起删
- [ ] `forge build && forge test`
- [ ] CI grep:`src/` 里禁出现 `LLTV`、`LIF`、`RCF`、`lossFactor`、`liquidat`
- [ ] 提交 `feat(purge): delete LIF/RCF/LLTV constants and liquidation lock`

#### Task 1A.7 — Milestone 1A 收尾闸门

- [ ] grep 上述关键词全空
- [ ] `forge test` 全绿
- [ ] 用 `superpowers:requesting-code-review` 请人 review 本 milestone
- [ ] Review 后合入 `main`

### Milestone 1B — 加 per-collateral strike 纪律

v0.1 保留 Midnight 多抵押,所以 **strike 放在 `CollateralParams` 上**,不放在 `Market` 上。每个抵押 index 有自己的 strike、oracle、PAT 需求。`maxDebt` 变为:

```
maxDebt = Σ (position.collateral[i] × collateralParams[i].strike)   over active bitmap
```

Midnight 原公式 `Σ c_i × p_i × LLTV_i` 整体被替换 —— LLTV 已在 1A.6 删除,strike 顶替。maxDebt 计算里**不读 oracle**,strike 本身就是 loan 计价。

#### Task 1B.1 — `CollateralParams` struct 加 `strike`

- 值域:`uint256`,单位 loan-per-collateral,按 `ORACLE_PRICE_SCALE` (1e36) 缩放
- 老字段 `lltv`、`maxLif` 已在 1A.6 删除

- [ ] 失败测试:不同 collateral 的 strike 变化 → market id 变化
- [ ] `CollateralParams` 加 `uint256 strike;`
- [ ] 更新所有 test 构造(多光标或 codemod)
- [ ] 测试通过 → 提交 `feat(strike): add per-collateral strike field to CollateralParams`

#### Task 1B.2 — `touchMarket` 校验 `strike`

- [ ] 失败测试:任意 `collateralParams[i].strike == 0` 时 revert `InvalidStrike`
- [ ] `error InvalidStrike();` + 遍历 `market.collateralParams` 检查非零
- [ ] 提交

#### Task 1B.3 — 重写 `maxDebt` 计算

- [ ] 失败测试:多抵押 `maxDebt = 0.5×100k + 3×3k = 59_000`
- [ ] 遍历 `collateralBitmap`,累加 `position.collateral[i] × collateralParams[i].strike / ORACLE_PRICE_SCALE`。**不读 oracle**
- [ ] 提交
- [ ] 加不变量:`debt ≤ maxDebt` 永远成立;放到 Milestone 1D 的 fuzz 套件

#### Task 1B.4 — 验证 SSTORE2 round-trip 保留新字段

- [ ] 写测试:存双抵押 Market(两个 CollateralParams 都有非零 strike),读回来断言相等
- [ ] 无需改代码 —— `IdLib` 用 `abi.encode(market)`,数组带新字段自动编码
- [ ] 单独提交

### Milestone 1C — PAT 接口与三个适配器

定义 `IPAT`,做**三个**参考实现(Deribit / Derive / 内部 pool)。

#### Task 1C.1 — 定义 `IPAT` 接口

- 见英文版 §Task 1C.1 完整签名(`Terms` struct + 5 个函数)
- [ ] 写接口文件,带完整 NatSpec
- [ ] 提交 `feat(pat): define IPAT interface`

#### Task 1C.2 — 实现 `AttestedPAT`(链下见证,Deribit 风格)

- [ ] 失败测试:错误签名者 mint 应 revert
- [ ] 实现 `mint` 用 `ECDSA.recover` 校验 attester
- [ ] 按每个失败测试 → 每个守卫 → 一次提交的节奏完成 counter、`Terms` 存储、`settle`、`attribute`

#### Task 1C.3 — 实现 `DerivePAT`(链上原生,完整集成)

- 范围:**完整集成**,不是骨架。Sepolia 上用 `MockDerive` 模拟(真实 Derive 在 Lyra L2)
- [ ] `MockDerive.sol` 严格对齐 Derive `IOption` / `ISettlementFeed` ABI(参考 [Derive docs](https://docs.derive.xyz/reference/options))
- [ ] 失败测试 → 实现 `DerivePAT.wrap(deriveTokenId)`(读 Derive option 参数、校验是 PUT、mint 内部 PAT id)
- [ ] 失败测试 → 实现 `settle()`(转调 Derive `settle`,收款后转发)
- [ ] 失败测试 → 尝试包 call option 时 revert `NotAPut()`
- [ ] 失败测试 → attribution 一次性(不能重复挂到第二个市场)
- [ ] 每步一次提交

#### Task 1C.4 — 实现 `ProtocolPAT`(内部 writer pool)

- **目的:** 覆盖 Deribit 与 Derive 都不上市的 (strike, expiry)。Hyperloop 或合作 MM 直接承接
- **模型:** writer 存 loan token 抵押 = `strike × notional`;maker 挂单时付 premium 给 writer;到期若 OTM writer 取回抵押,ITM 抵押用于兑付
- [ ] 失败测试 → 实现 `deposit(loanToken, amount)`,记录 writer balance
- [ ] 失败测试 → 实现 `writePut(Terms terms, uint256 premium)`,锁定 `strike × notional`,mint PAT,转 premium 给 writer
- [ ] 失败测试 → 实现 `settle()`,到期 ITM 用 writer 抵押付 `(K-S) × notional`
- [ ] 失败测试 → 实现 `withdraw()`,只能取未锁部分
- [ ] 失败测试 → 尝试写 Deribit/Derive 已上市的 (strike, expiry) 应 revert `ExternalCoverageAvailable`(通过 admin 签名的 "gap manifest" 校验)
- [ ] 每步一次提交

### Milestone 1D — 改造 `take()` 挂上 per-collateral PAT attribution

**协议里风险最高的改动**。慢慢来。

多抵押场景下,借款人的 position 可能跨多种 collateral。`onBuy` 返回**数组** PAT attribution,每个都要按对应 `CollateralParams` index 通过 4 个不变量校验。

#### Task 1D.1 — 修改 `IBuyCallback.onBuy` 签名

- 新签名:
  ```solidity
  struct PATAttribution {
      uint8 collateralIndex;
      address pat;
      uint256 patTokenId;
  }
  // 旧: onBuy(units, buyerAssets, data) returns (bytes32)
  // 新: onBuy(units, buyerAssets, data) returns (bytes32 magicValue, PATAttribution[] memory attributions)
  ```
- [ ] 只返回魔法值的 callback 编译不过 —— 改测试 mock
- [ ] 改接口、重编、修 mock 编译错误
- [ ] 提交

#### Task 1D.2 — 强制 4 个 per-collateral PAT 不变量

对每个 `PATAttribution a` 分别校验对应 `collateralParams[a.collateralIndex]` 的 underlying / strike / maturity;再按 collateral index 聚合校验总 notional ≥ 该 index 的抵押量:

```solidity
CollateralParams memory cp = market.collateralParams[a.collateralIndex];
IPAT.Terms memory t = IPAT(a.pat).terms(a.patTokenId);
if (t.underlying != cp.token) revert PATUnderlyingMismatch();
if (t.strike != cp.strike) revert PATStrikeMismatch();
if (t.expiry < market.maturity || t.expiry > market.maturity + MAX_EXPIRY_TOLERANCE)
    revert PATMaturityMismatch();
// 全部 attribution 处理完后:
for each active collateralIndex i:
    if (Σ notional where collateralIndex==i < position.collateral[i])
        revert PATNotionalInsufficient(i);
```

- [ ] 失败测试(多抵押场景,ETH PAT strike 错误)→ 一个守卫 → 一次提交,4 个不变量各一轮

#### Task 1D.3 — 成交时把每个 PAT 都 attribute 到市场

- [ ] 失败测试:多抵押成交后每个 PAT 都 `attributedTo == address(awakening)`
- [ ] 遍历 attributions 分别 `IPAT.attribute()`;存 `attributedPATs[marketId][collateralIndex]` append-only list
- [ ] 每个 attribution emit `PATAttributed(marketId, collateralIndex, pat, tokenId, notional)`;提交

#### Task 1D.4 — Fuzz + Invariant 测试

- [ ] 加 per-collateral 不变量:`Σ (c_i × strike_i) ≥ debt` 对每个 position
- [ ] 加 PAT 覆盖不变量:每个 (market, collateralIndex) 上 Σ 已归属 PAT notional ≥ 该 index 的总抵押量
- [ ] `forge test --match-test invariant_ -vv` 跑 10k 轮
- [ ] 修复反例,提交

### Milestone 1E — Settlement 合约

新合约 `AwakeningSettlement.sol` —— "关市场"的逻辑。

**状态机:** `PRE_MATURITY → ORACLE_READ → PAT_REDEEMED → REPAY_WINDOW_OPEN → REPAY_WINDOW_CLOSED → FINAL`

#### Task 1E.1 — 骨架 + 状态机

- [ ] 每个非法转移写一个失败测试
- [ ] 实现 State enum + `modifier onlyInState(State s)`;每个转移一次提交

#### Task 1E.2 — `readOracleAtMaturity`

- [ ] 到期前调用应 revert
- [ ] 实现:存 `terminalPrice`;emit `TerminalPriceRead`
- [ ] 不能调两次;提交

#### Task 1E.3 — `redeemPATs`

- [ ] 兑付后合约持有 `sum(max(K-S, 0) * notional)` loan tokens
- [ ] 遍历已归属 PAT,`IPAT.settle()` 各调一次
- [ ] 部分 PAT 失败 emit `PATSourceShortfall`,转 `SHORTFALL` 子态;try/catch 包裹;提交

#### Task 1E.4 — 还款窗口(默认 24h)

- [ ] 借款人在窗口内用 loan token 还债、拿回 collateral
- [ ] 实现 `repay(units)`:扣 debt、`withdrawable` +=、还 collateral;提交

#### Task 1E.5 — 窗口后的 collateral 处置

- [ ] 窗口后未领回的 collateral 按恒等式 `min(S,K) + max(K-S,0) = K` 兑给 lender
- [ ] 实现 `finalize()`:合并剩 collateral + PAT 收益;每 credit unit 通过 `withdraw()` 兑 1 loan token
- [ ] 溢余归 `surplusRole`(市场创建时设);提交

#### Task 1E.6 — 把 settlement 地址接到 Market

- [ ] Market struct 加 `address settlement`
- [ ] `take()` 里校验 `market.settlement` 是实现了 `IAwakeningSettlement` 的已部署合约;提交

### Milestone 1F — 费用调整与收尾

#### Task 1F.1 — PAT attribution fee(上限 5% of premium)

- [ ] `ConstantsLib` 加 `MAX_PAT_ATTRIBUTION_FEE = 5e16`
- [ ] 加 per-market `patAttributionFee`,上限 MAX
- [ ] `take()` 里在 PAT attribute 后从 maker 扣 `fee = premium * patAttributionFee / WAD`,给 `feeRecipient`
- [ ] 测试 + 提交

#### Task 1F.2 — 最终 grep 清扫

- [ ] `grep -rn 'Midnight\|midnight\|MIDNIGHT' contracts/src contracts/test` 应为空
- [ ] `grep -rn 'liquidat\|LLTV\|LIF\|RCF\|lossFactor\|isHealthy' contracts/src` 应为空
- [ ] 更新 contracts 目录下 `README.md`(若还提到 Midnight)

### Milestone 1G — 测试覆盖与 Certora

#### Task 1G.1 — 覆盖率

- [ ] `forge coverage --report lcov`;每个未覆盖分支加测试
- [ ] 目标:行 95%、分支 90%

#### Task 1G.2 — 适配 Certora spec

- [ ] **删:** `Liquidate.conf`、`LossFactor.conf`、`Healthiness.conf`、`LiquidationBoundedByLIF.conf`、`LiquidationProfitability.conf`、`NoDebtWithoutCollateral*.conf`、`PostMaturityDebt.conf`、`SplitDoesNotPunishMakerOrFavorTaker.conf`
- [ ] **新增:** `PATInvariant.conf`(证 `sum(credit_at_maturity) ≤ sum(K * pat_notional / 1e36)`)
- [ ] **新增:** `NoOracleReadBeforeMaturity.conf`
- [ ] 逐个 `certoraRun`;修反例

#### Task 1G.3 — Phase 1 收尾评审

- [ ] `superpowers:requesting-code-review`,目标是整个 `contracts/src/`
- [ ] 处理每一条评审意见
- [ ] 把 draft PR 交给 Spearbit / Blackthorn / TrustSec —— 在 Midnight 继承的 3 份审计基础上追加 delta

---

## Phase 2 — 后端(Java + Spring Boot)

Milestone 1D 落地后并行开始。

Milestones:
- **2A** 骨架 · **2B** 链索引器 · **2C** Offer 中继 · **2D** PAT 源适配器(Deribit + Derive + 内部 pool) · **2E** 分层 Router API

### Milestone 2A — 骨架

- **Task 2A.1** 拉 Spring Boot 项目:`spring init --dependencies=web,data-jpa,flyway,postgresql,validation --java-version=21 --build=maven backend/`;加 web3j 4.12+;验证 `mvn spring-boot:run`
- **Task 2A.2** 本地 Postgres + Flyway V1:`ops/docker-compose.yml` 起 Postgres 16 + anvil;`V1__initial_schema.sql` 建 `markets/offers/takes/pat_attributions/positions/settlements` 表
- **Task 2A.3** 由 ABI 生成 web3j 绑定:`forge build --extra-output abi` → `web3j generate solidity`
- **Task 2A.4** Milestone 2A 回顾 —— 用 §0.3 退出条款判断 Java 是否继续

### Milestone 2B — 链索引器

- **2B.1** 事件订阅:`MarketCreated / Take / PATAttributed / SettlementExecuted / Repay / WithdrawCollateral`,web3j `flowable()`,原始 log + 解码字段入 Postgres,confirmations ≥ 12 才算 final
- **2B.2** 物化视图:事件聚合成 `positions` 与 `markets`,每 5s 刷新
- **2B.3** 回填 CLI:`mvn exec:java -Dexec.mainClass=...Backfill -Dblock.from=X`

### Milestone 2C — Offer 中继

链下 offer 存储与查询。Maker 在链下签,relay 存并给 taker/router 消费。

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/v1/offers` | 完整 Offer + 签名;验签、存 |
| GET | `/api/v1/offers?market={id}&side={buy\|sell}` | 返回活跃 offer,按价排序 |
| DELETE | `/api/v1/offers/{root}` | Maker 撤销 Merkle root |

- **2C.2** Merkle offer 批量:`POST /api/v1/offer-bundles` —— maker 交 Merkle root + 叶子;客户端可请求任意叶子的证明

### Milestone 2D — PAT 源适配器

三个独立子服务,一 PAT 源一个。每个暴露:(a) 库存查询 —— "这个源在 (strike, expiry, notional) 上有 put 吗?",(b) commit —— "生成能让链上 `IPAT.mint()` 接受的东西"。

- **2D.1 Deribit 适配器(主流动性):** 轮询 Deribit `/private/get_positions`(maker API key 放 KMS);与托管方(Coinbase Custody Deribit 账户或类似)签名 feed 对照;`GET /api/v1/attestations/deribit?maker=X&collateral=BTC&strike=Y&expiry=Z&notional=N` 返回 `AttestedPAT.mint()` 能接受的 ECDSA 签名;attester 私钥**只放 AWS KMS,不入代码不入 env**
- **2D.2 Derive 适配器(无信任兜底):** Derive Lyra L2 RPC 连接;`GET /api/v1/inventory/derive?collateral=BTC&strike=Y&expiry=Z` 列出匹配的 Derive put token + 持有人 + notional;maker 便利:`POST /api/v1/derive/wrap-tx` 返回未签的 tx bytes 调 `DerivePAT.wrap()`
- **2D.3 内部 writer pool 适配器(补缺):** Postgres 表 `writer_pool_positions` 记 writer/collateral/strike/expiry/notional/locked/premium;`GET /api/v1/inventory/internal?...` 返回可用 writer + 报价;`POST /api/v1/internal/write` 签请求供 maker 提交 `ProtocolPAT.writePut`;"gap manifest" 服务 emit 签名清单(Deribit + Derive 都没有的 (collateral, strike, expiry)),`ProtocolPAT` 靠它防止与外部 venue 竞争;writer 池利用率 > 80% 报警
- **2D.4 健康看板:** `/api/v1/health/pat-sources` 返回每个源的存活/attestation 速率/今日 notional/最新错误 —— 前端 Portfolio 页读此显示绿/黄/红指示灯

### Milestone 2E — 分层 Router API

Router 在每笔成交中跨三个 PAT 源做选择。偏好顺序(可通过 market 的 `patGate` 配置):**Deribit → Derive → 内部 pool**。多抵押场景下按 collateral index 分别取 PAT。

- **2E.1 库存聚合器:** `GET /api/v1/inventory?collateral=BTC&strike=Y&expiry=Z&notional=N` 聚合三个适配器,返回分层清单;缓存 30s;`PATAttributed` 事件触发失效
- **2E.2 最佳成交端点:** `GET /api/v1/route?market={id}&side={buy|sell}&amount={x}` 返回:
  - 有序 offer 消费清单
  - **per-collateral PAT 计划:** 对每个 active collateral index,哪个源承接 + notional 分配
  - 预取的 attestation(Deribit 签名内联;Derive `wrap` calldata;内部 pool 签名)
  - `AwakeningBundles.multicall` 原子 tx calldata
- **2E.3 兜底逻辑:** maker 选中的 PAT 源在成交时耗尽 → 自动降到下一层(emit `PATSourceFallback` 便于观测);三个源都耗尽 → HTTP 503 + `Retry-After` + 提示哪个 strike/expiry 能填

---

## Phase 3 — 前端(Next.js)

ABI 稳定 + 后端 Milestone 2C 完成后开始。

### UX 设计 —— 4 个核心页面

#### Screen 1 — Markets(`/markets`)

- 市场卡片网格。每卡:collateral logo、loan asset、到期倒计时、strike(相对 spot %)、最佳借款利率、最佳出借利率、PAT-source 徽章
- 过滤器:collateral (BTC/ETH)、到期段 (<30d / 30–90d / >90d)、PAT 源 (Deribit-attested / Derive on-chain)
- 空状态:"No markets yet. Be the first to create one." + `/markets/create` 链接

#### Screen 2 — Borrow(`/borrow/[marketId]`)

- **左侧:** 市场摘要(strike、maturity、抵押要求、put 源)
- **右侧:** 表单
  - 输入:抵押数量(带 oracle 换算的 USD)
  - 计算显示:最大借款(= strike × collateral)、利率(来自最佳 offer)、费用、总成本
  - 按钮:"Preview borrow" → 展示 tx 拆解(approve + supplyCollateral + take,通过 AwakeningBundles 原子化) → "Sign transaction"
- **成交后:** 持仓卡片,倒计时,"you owe X USDC at T_M"

#### Screen 3 — Lend(`/lend/[marketId]`)

- 与 Borrow 对称。输入借款金额、显示利率、tx 预览、持仓卡片
- 强调非清算叙事:"Your principal is backed by a put on X BTC at K, expiring T_M"

#### Screen 4 — Portfolio(`/portfolio`)

- 所有开仓(borrow + lend)
- **每个 borrow:** 倒计时、"Repay early"(如有 buy offer)、已付利率
- **每个 lend:** 倒计时、预期收益、PAT 源健康指示灯(基于见证新鲜度)
- **到期后 24h:** "Repay" 或 "Claim" 按钮激活

### Milestone 3A — 骨架

- [ ] `pnpm create next-app frontend --typescript --tailwind --app`
- [ ] 加 wagmi v2、viem、RainbowKit、@tanstack/react-query、shadcn/ui
- [ ] `app/layout.tsx` 配 provider,含 Sepolia
- [ ] `.env.local` 放后端 API URL、WalletConnect project ID

### Milestone 3B — Markets 页

- [ ] `app/markets/page.tsx` server component,fetch `/api/v1/markets`
- [ ] shadcn `Card` 组件展市场字段
- [ ] 客户端过滤器(`nuqs` 同步到 URL)
- [ ] 空/加载/错误态
- [ ] Playwright `e2e/markets.spec.ts` —— 种子 N 个市场断言渲染 N 张卡

### Milestone 3C — 借款流程

- [ ] `app/borrow/[marketId]/page.tsx`
- [ ] 表单:react-hook-form + zod
- [ ] 利率报价 hook:`useRateQuote`,300ms debounce,打 `/api/v1/route`
- [ ] 交易:`useSimulateContract` + `useWriteContract`;成功后 refetch portfolio
- [ ] sonner toast 报 tx 状态
- [ ] Playwright:全流程跑 Sepolia + 本地 anvil fork

### Milestone 3D — 出借流程

- [ ] 与借款对称

### Milestone 3E — Portfolio

- [ ] `app/portfolio/page.tsx`
- [ ] `useReadContracts` (multicall) 拿实时仓位
- [ ] 倒计时
- [ ] Repay 按钮:弹窗 → approve USDC + 调 `AwakeningSettlement.repay`
- [ ] Playwright:开借款 → 还款 → 拿回抵押

### 集成契约(前端 ↔ 后端 ↔ 链)

| 数据 | 来源 | 原因 |
|---|---|---|
| 用户自己的仓位、allowance、当前区块、ETH 余额 | **链**(`useReadContract`) | 必须实时且无信任 |
| 市场列表、offer 簿、PAT 见证、历史利率 | **后端**(链为 ground truth,后端做缓存) | 需要在 Postgres 里可查、可排序 |
| 所有写操作 | **链**(用户签) | 后端**永不**代签 |
| 服务消息(见证、offer-relay 授权) | **后端**签 | 这些是后端自己的数据 |
| Router calldata | 后端算,前端提交 | 前端拿到 ABI 编码的 calldata + PAT proof,提交成一个 `AwakeningBundles.multicall`。用户只签一次。 |

---

## Phase 4 — 测试与验收

滚动进行;Sepolia 上线前有正式闸门。

### 合约验收清单

- [ ] `forge test` 全绿
- [ ] `forge coverage`:`src/` 行 ≥ 95%、分支 ≥ 90%
- [ ] `forge test --match-test invariant_ --runs 100000` 通过
- [ ] Certora 所有 spec 通过
- [ ] `slither src/ --exclude-dependencies` 无 High/Medium
- [ ] `take()`/`withdraw()`/`repay()` gas 相对 Midnight 基线 ±20% 内
- [ ] 至少一家审计所对 PAT 层 delta 签字
- [ ] 所有 review 意见走完 `superpowers:receiving-code-review`

### 后端验收清单

- [ ] 所有服务集成测试用 Testcontainers Postgres 通过
- [ ] 索引器 10 分钟内回放完 Sepolia 全部 Awakening 历史
- [ ] 压测(k6 或 Gatling):`/api/v1/route` 100 rps 持续 5 分钟,p99 < 500ms
- [ ] 混沌测试:索引中杀掉 Postgres → 重启后干净恢复

### 前端验收清单

- [ ] Playwright e2e 覆盖:连钱包 → 看市场 → 借款 → 还款 → 拿回抵押。CI 绿。
- [ ] Lighthouse 移动端 Markets 与 Portfolio 分 ≥ 85
- [ ] 所有金额显示带正确小数、货币符号、USD 等价
- [ ] 每笔交易签名前有预览:合约、函数、解码后参数、gas 估算
- [ ] 拒签 / revert 路径展示可读错误(非裸 hex)

### Alpha 上线清单(Sepolia)

- [ ] 用 `ops/deploy/sepolia.sh` (Foundry) 部署合约
- [ ] 种 5 个市场:BTC/USDC,strike 90k/100k/110k,maturity 30d/60d/90d
- [ ] 给 maker EOA 打测试 loan token;通过 offer-relay 发布 20 个 offer
- [ ] mock Deribit attester 签测试 PAT
- [ ] 发布 `alpha.awakening.hyperloop-fi.xyz`
- [ ] 招 10 个外部测试者(crypto 圈朋友 + 一个机构联系人)
- [ ] 跟踪:bug 数按严重度、平均每笔 gas、每用户首次借款时间
- [ ] Alpha 后 retro:决定 v0.2 范围(上主网?call-attribution 零息 collar?strike-rolling 市场?)

---

## 附录 A — Worktree 建议

**结论:workspace 级别不要 worktree;里程碑级别用 feature 分支即可。**

Awakening/ 已经是独立 git 仓库。在 workspace 再套一层 worktree 不带来隔离,只多一个目录。你真正想要的隔离是 feature 之间的,不是"这个项目 vs 别的 Hyperloop 东西"之间的。

### 什么时候在 `Awakening/` 里用 worktree

1. **Milestone 1A → 1B → 1C 之间** —— 都在改同一批 Solidity 文件。若想在 "已清算-purge 的分支" 保持稳定的同时并行探索 PAT 设计:
   ```bash
   cd Awakening
   git worktree add ../Awakening-pat-explore feat/pat-design
   ```
   用完删。
2. **Certora 跑得慢(5-30 分钟)。** 想在 Certora 跑的时候写代码,把跑 Certora 的分支 worktree 出去,别影响你手上的编辑器状态。
3. **审计回应分支。** Spearbit 发回 findings 时,`feat/audit-spearbit-response` worktree 出去 —— 你可能需要同时维护多个审计回应分支。

### 什么时候**不**用 worktree

- 纯文档编辑(本文件、README、ADR)
- 不动合约的前端/后端工作 —— 那些目录独立,分支翻动不影响合约
- 1 天内能完成的任何东西

### 强制

在 `docs/CONTRIBUTING.md` 加一条:*"任何 PR 若动 `contracts/src/Awakening.sol` 或改动 > 100 LOC:必须用 worktree。"*

---

## 附录 B — 决策记录

2026-08-01 会话中定的。

| # | 问题 | 决策 | 理由 |
|---|---|---|---|
| 1 | v0.1 多抵押? | **保留 Midnight 全部多抵押**(每 market 最多 128 种)。每个 `CollateralParams` 有自己的 strike。 | 机构买家期望完整产品面。省下的简化换来的是 v0.2 重构成本。 |
| 2 | 上线用哪些 PAT 源? | **三个都上,分层:** Deribit 主 → Derive 兜底 → 内部 writer pool 补缺 | Deribit 给机构 BTC/ETH 深度;Derive 给无信任选项;内部池覆盖非标 strike。 |
| 3 | 还款窗口 | **硬编码 24h** | 合约状态更简单;per-market override 延后 v0.2。 |
| 4 | Sepolia oracle | **Chainlink Sepolia BTC/USD;到期时取最近 30 分钟 TWAP** | 反操纵的成本合算。 |
| 5 | 前端部署 | **Vercel** | Next.js 原生支持,预览 URL,零配置。v0.1 不担心 egress。 |
| 6 | 合约审计预算 | **延后 —— Phase 1G 收尾时再定** | 相对 Midnight 的 delta 现在还不清楚,现在定预算过早。Phase 1G 后重新评估:Spearbit 延伸 / 换新审计所 / 双审计所并行 —— 哪种匹配实际改动量。 |

**Q6 说明:** Sepolia alpha **不**需要扩展审计。审计决策只挡主网,不挡 alpha。Phase 1G 完成时在 `docs/decisions/003-audit-scope.md` 里正式定。

---

# 执行选择

**Plan 已保存到 `Awakening/Awakening Implementation Plan.md`。两种执行方式:**

1. **Subagent-driven(推荐)** —— 每个任务派一个新 subagent,我在任务间 review;适合 Phase 1 的 TDD 步骤
2. **Inline execution** —— 在本会话用 `superpowers:executing-plans` 批量执行,带 checkpoint;更适合先把附录 B 决策讨论清

**建议下一步:** 附录 B 决策已定(2026-08-01)。从 Task 0.1 用 subagent-driven 开跑。Q6(审计预算)在 Phase 1G 收尾时重开决策。
