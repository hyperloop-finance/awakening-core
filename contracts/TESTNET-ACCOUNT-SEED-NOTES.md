# Account demo: contract boundary noted during preparation

The BNB testnet account demo uses real test-token transactions and simulated PAT protection. It does not represent real financing or live options.

## Do not mix an old residual claim with a new loan in the same market

Source inspection: `src/libraries/AwakeningLoans.sol`, `claimPutProceeds` unconditionally clears `borrowerLoan[id][borrower]` before deleting the claimed loan. If a fully repaid historical loan has outstanding put resale proceeds and that borrower opens a new loan in the same market, claiming the old proceeds could clear the new loan's pointer. This is a source-level finding, not a testnet exploit reproduction.

The demo deliberately avoids this combination. A contract fix and regression test should require the stored pointer to match the claimed loan before clearing it (or remove the redundant clear after confirming lifecycle invariants). Frontend hiding alone is not a contract fix. No deployed contracts were modified for this UI task.

Demo intent: operator wallet holds 500 tUSDC borrow debt and 300 tUSDC lender credit; a counterparty repayment leaves at least 100 tUSDC in the market available for withdrawal. Public transaction receipts are written under `Awakening/.local-runtime/account-seed-*.json` by the explicit testnet seeding script. The script does not write private keys.

## Verified result — 2026-10-17

Wallet: `0x7E406D8d82a7Cf4139d1d6e84EA085A7f60F1591`.

- Debt: 500 tUSDC; collateral: 0.0125 tBTC; PAT #3; maturity 2026-11-01.
- Lender credit: 300 tUSDC; available payout: 100 tUSDC.
- Signed 200 tUSDC lend order registered in the relay; expires one hour after signing. Orders are off-chain signatures; positions and repayment are on-chain.
- Borrow completion: `0x1a22157f1e9de6028a5c0a53caf5a277ee6f0ed702a6873daf59d6cabfe76c3f`.
- Lend completion: `0x61b4d1f1200c293877534773e6e14f9fbe6b58e9f67025c9273c627350f22b61`.
- Counterparty repayment: `0xa474d6141fa567bee39fe45221b7cc7bf4e4a158637162030190d95c49bc0fb8`.

The original seed receipt file reports `complete: false` because its final market check ran before the repayment was indexed (account block 137332542 preceded repayment block 137332559). No transaction failed. Subsequent API read at block 137332993 and browser verification at block 137333893 confirmed all balances above. The script now waits for the market view as well; it was not rebroadcast. Do not rerun it against the existing seeded position.
