import type { MarketDetail, Quote } from "@/lib/api/types";
import { formatFixedDecimal, parseFixedDecimal } from "@/lib/fixed-decimal";

export function canPreviewOffer({
  hasQuote,
  previewed,
}: {
  hasQuote: boolean;
  previewed: boolean;
}) {
  return hasQuote && previewed;
}

export function lendDetails(market: MarketDetail): [string, string][] {
  return [
    ["Minimum amount", `${market.minimumAmount} USDC`],
    ["Fixed APR", `${market.fixedApr}%`],
    ["PAT coverage", `${market.patCoverage}%`],
  ];
}

export function buildUnsignedOfferPayload({
  quote,
  marketId,
  chainId,
  wallet,
}: {
  quote: Quote;
  marketId: string;
  chainId?: number;
  wallet?: string;
}) {
  return [
    "Awakening Mock Offer",
    `chainId:${chainId ?? "<runtime config required>"}`,
    `wallet:${wallet?.toLowerCase() ?? "<wallet required>"}`,
    `marketId:${marketId.toLowerCase()}`,
    `amount:${formatFixedDecimal(parseFixedDecimal(quote.principal))}`,
    `apr:${formatFixedDecimal(parseFixedDecimal(quote.apr))}`,
    `expiry:${quote.expiresAt}`,
  ].join("\n");
}
