# Product
<!-- impeccable:product-schema 1 -->

## Platform
Web; Next.js, React, wagmi and viem.

## Product and audience
Hyperloop Awakening is a fixed-maturity lending application. The current deployment is for testers using BNB Testnet wallets, not real assets.

## Confirmed task
Add Faucet after Settlement. Show token logos, wallet balances, actual claim quantities, and wallet-confirmed claims. Preserve the existing visual identity and other pages. Test assets have no monetary value; simulated stock tokens are not official issuer tokens. Native test BNB is needed for gas. Only tokens with deployed and verified faucet contracts can be claimed.

## Constraints
Changes stay inside Awakening. Never expose signing secrets to the browser. Preserve wallet/network checks and transaction confirmation. Additional faucet tokens do not automatically create lending markets.
