# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Crypto-native borrowers and lenders evaluating fixed-rate, fixed-maturity credit against BTC or tokenized securities in a local or testnet environment. They need to compare a market, understand PAT coverage, preview every transaction step, and inspect their positions without mistaking mock data for production state.

## Product Purpose

Awakening provides non-liquidative, PAT-backed credit. The local v0.1 experience lets users explore markets and complete Borrow, Lend, and Portfolio preview flows before Sepolia contracts are deployed.

## Positioning

Every loan is paired with explicit put attribution and settles at maturity instead of exposing borrowers to interim liquidation.

## Operating Context

Users operate a dense financial dashboard on desktop and mobile, compare exact decimal values, connect an injected EVM wallet or use a demo wallet, and review a readable multi-step transaction preview before any signing action.

## Capabilities and Constraints

- Markets, Borrow, Lend, and Portfolio are required first-round surfaces.
- The default local runtime uses deterministic mock/API data; no Sepolia deployment exists yet.
- Contract addresses are nullable and live transactions remain disabled until a safe deployed integration exists.
- The deterministic preview catalog includes BTC/USDC plus QQQB, SPCXB, NVDAB, and BNCB examples settled in USDC or USDT; these are mock terms, not live Binance or on-chain markets.
- Never expose the legacy unsafe `take()` or `repay()` paths.
- Decimal-string precision and OpenAPI wire compatibility must be preserved.

## Brand Commitments

- Product name: Awakening.
- The visual authority is the read-only `website/awakening-mvp` reference: near-black cosmic ground, violet/lavender hierarchy, dense market tables, precise PAT/status badges, restrained ambient light, and transaction detail panels.
- The implementation may improve responsiveness, accessibility, information hierarchy, and EVM-specific content without drifting into a generic SaaS dashboard.

## Evidence on Hand

- Working local backend API and deterministic mock catalog.
- Read-only visual reference at `website/awakening-mvp`.
- No production TVL, customer, deployment, or performance claims may be fabricated.

## Product Principles

- Make transaction consequences legible before action.
- Distinguish preview/mock state from deployed protocol state at all times.
- Favor exact financial information and scanability over decorative cards.
- Keep the non-liquidative and PAT-backed mechanism visible in every core flow.
- Preserve full keyboard and mobile usability.

## Accessibility & Inclusion

Keyboard-visible focus, semantic tables and form labels, reduced-motion support, readable contrast, and mobile touch targets of at least 44px are required.
