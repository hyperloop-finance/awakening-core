# Awakening

**Building non-liquidative fixed-rate credit infrastructure for Bitcoin.**

Long-duration BTC holders — treasuries, family offices, listed-company shareholders — need liquidity against their collateral without the path-dependent risk of forced liquidation. Traditional DeFi lending refuses this demand; it gets served bilaterally over-the-counter, expensively.

Hyperloop brings this market on-chain.

## What Awakening does

A non-liquidative, fixed-rate, fixed-maturity lending protocol on EVM.

- **Non-liquidative.** Borrowers are never subject to interim liquidation during the term of a loan. Lender principal is protected by a put option attributed to each loan at origination — if the collateral terminates below strike at maturity, the put pays out and the lender receives the full notional. There is no oracle path during the loan term that triggers forced action on borrower positions.

- **Fixed-rate, fixed-maturity.** Every market has a defined maturity date and a strike. Interest rates are discovered through offer-based order matching, not variable pool utilization curves. A 90-day loan against a 90-day put is one product, not two.

- **Options routed from real venues.** Puts are sourced and attributed at fill-time from established option markets:
  - **[Deribit](https://www.deribit.com/)** — via qualified custodian attestation (institutional put liquidity)
  - **[Derive](https://www.derive.xyz/)** — on-chain native, no attestation needed
  - Internal put writer pool as fallback for maturities/strikes not listed elsewhere

  Makers hedge externally on these venues and quote against the net funding cost — Awakening does not create option liquidity, it routes existing option liquidity into non-liquidative credit.

- **Based on [Morpho Midnight](https://github.com/morpho-org/midnight).** We inherit Midnight's offer-based market primitive (isolated, immutable, permissionlessly created markets) and add the put attribution token (PAT) layer that eliminates interim liquidation.

## Status

**Under active development. Not audited. Not deployed to any mainnet.**

The frontend and backend now run from this single checkout. BNB Testnet (chain 97) supports signed orders, borrowing/lending positions, repayment, payouts and a five-asset faucet. PAT protection is simulated and operator-completed; this is not live Deribit protection. See [local setup](LOCAL-BSC-TESTNET.md) and [architecture](ARCHITECTURE-OVERVIEW.md).

## Repository structure

```
awakening-core/
├── contracts/    Solidity contracts (Foundry). Based on Morpho Midnight + PAT layer.
├── frontend/     Next.js UI, wallet signing, markets, orders, positions, settlement and faucet.
├── backend/      Spring Boot API, PostgreSQL event index and signed-order relay.
├── audits/       Audit reports (as they arrive).
└── ops/          Deployment scripts and infrastructure.
```

## License

[MIT License](LICENSE) — Copyright © 2026 Hyperloop Finance.

Free to use, modify, and redistribute with attribution; provided as-is without warranty.

## Contact

[deal@hyperloop-fi.xyz](mailto:deal@hyperloop-fi.xyz)
