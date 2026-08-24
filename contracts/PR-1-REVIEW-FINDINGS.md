# Contract PR #1 Review Findings

Review target: `hyperloop-finance/awakening-core` PR #1
Reviewed commit: `c48200c94139bee5a9b3aed968d06984315bd22e`
Review date: 2026-08-24

## Verification performed

The PR was compiled and tested from a temporary checkout using Foundry.

```text
Ran 30 test suites: 380 tests passed, 0 failed, 0 skipped.
```

Passing tests do not cover the cross-entry-point failures described below. The
P0 findings should be fixed before a testnet deployment that holds user funds.

## P0: legacy `take()` bypasses the PAT-backed loan flow

Location: `src/Awakening.sol`, legacy `take()` entry point.

The legacy `take()` function remains publicly callable and can still increase a
seller's debt. That path does not:

- escrow collateral;
- use `OptionVault`;
- mint or attribute a PAT;
- create a `Loan` record; or
- pass through `takeInit()` and `completeTake()`.

This permits debt to be created without the put coverage that defines the
Awakening product. The legacy entry point should be restricted to transitions
that cannot increase debt. All debt-increasing fills must use the two-step
loan-creation flow.

Required regression test: attempt to increase debt through legacy `take()` and
assert that it reverts without changing debt, credit, consumed amounts, token
balances, or collateral.

## P0: legacy `repay()` desynchronizes `Position` and `Loan`

Locations:

- `src/Awakening.sol`, legacy `repay()`;
- `src/libraries/AwakeningLoans.sol`, `repayLoan()` and `settleLoan()`.

A loan created through the two-step flow can still be repaid through the legacy
`repay()` function. Legacy repayment reduces `Position.debt`, but it does not
update `Loan.lastRepaid` or the loan lifecycle mappings.

After using legacy `repay()` to reduce debt to zero, the borrower can pass the
debt check in `withdrawCollateral()` and remove collateral while the `Loan`
record still reports unpaid principal. Later settlement attempts to subtract
the same remaining debt again and can revert on underflow, blocking market
settlement.

All repayments associated with an active `Loan` must update `Position` and
`Loan` atomically. A legacy repayment must either route through the loan-aware
path or reject borrowers with an active loan.

Required regression test: create a two-step loan, call legacy `repay()`, attempt
collateral withdrawal, and then execute maturity settlement. Assert that no
state divergence or double-accounting is possible.

## P1: unbounded market-wide settlement loops can exceed the block gas limit

Location: `src/settlement/AwakeningSettlement.sol`,
`_snapshotDefaultedLoans()`, `settle()`, and `_distributeRemainder()`.

Settlement scans the entire historical `marketLoanIds` array and then loops
over defaulted loans again. Entries are not removed from the historical array.
As a market accumulates loans, a single `settle()` transaction can eventually
exceed the block gas limit and make final settlement impossible.

Use a bounded batch or paginated settlement design. Progress must be stored so
that any market can be finalized across multiple transactions.

Required tests: settle a market in multiple batches, retry an already processed
batch, mix repaid and defaulted loans, and verify that rounding and final state
are independent of batch boundaries.

## P1: the borrower does not authorize a maximum option premium

Location: `src/libraries/AwakeningLoans.sol`, `completeTake()`.

The option keeper supplies `premium` after the borrower has entered the pending
take. The only on-chain ceiling is the full net loan amount. Neither the pending
take nor the custodian attestation binds a borrower-approved `maxPremium` or
minimum borrower proceeds.

An option keeper can therefore report a premium close to the entire net loan
amount. Add a borrower-authorized slippage bound to `takeInit()` and enforce it
in `completeTake()`. The bound should be included in signed or ratified data so
that a relayer cannot alter it.

## P1: `reportPutResale()` does not bind `id` to `loanId`

Location: `src/settlement/AwakeningSettlement.sol`, `reportPutResale()`.

The function selects the token to transfer using the supplied market `id`, then
credits the supplied `loanId`, but does not verify that the loan belongs to that
market. A mismatched pair can pull one market's loan token while recording a
claim denominated in another token.

Require `IAwakening(AWAKENING).loans(loanId).id == id` before transferring
funds. Add a regression test using two markets with different loan tokens.

## Trust-model limitation: PAT settlement is not on-chain enforceable

Locations:

- `src/pat/AttestedPAT.sol`, `settle()`;
- `src/settlement/AwakeningSettlement.sol`, `redeemPATs()` and `settle()`.

`redeemPATs()` changes protocol state but does not call the PAT contract.
`AttestedPAT.settle()` records a payout and emits an event but does not transfer
assets. Final proceeds are reported and funded by the option keeper.

This makes the current PAT a custodian-signed attribution record, not an
on-chain-enforceable principal guarantee. If this is intentional for v0.1, the
trust assumption and keeper failure recovery process must be documented in the
protocol specification and user interface.

## Scope divergence: implementation is single-collateral

Location: `src/Awakening.sol`, `touchMarket()`.

The implementation requires exactly one collateral entry, while the existing
implementation plan describes up to 128 collateral types per market. Either
the implementation plan must be changed to explicitly define the single-BTC
v0.1 scope, or the contract must implement the planned multi-collateral PAT and
settlement semantics.

## Merge recommendation

The PR is a strong implementation base and its Foundry suite passes, but the two
P0 entry-point conflicts are release blockers. Do not deploy contracts that hold
user funds until those conflicts have regression tests and fixes. The P1 items
should be resolved before broad public testnet usage.
