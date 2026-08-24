import type { MarketDetail, Quote } from "@/lib/api/types";
import { formatFixedDecimal, parseFixedDecimal } from "@/lib/fixed-decimal";

export function canPreviewOffer({
  hasQuote,
  previewed,
  offerAprError,
}: {
  hasQuote: boolean;
  previewed: boolean;
  offerAprError?: string;
}) {
  return hasQuote && previewed && !offerAprError;
}

export function validateOfferApr(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value)) return "Use a plain decimal APR.";
  if ((value.split(".")[1]?.length ?? 0) > 8) {
    return "Use at most 8 decimal places.";
  }
  const apr = parseFixedDecimal(value);
  if (apr <= BigInt(0)) return "Enter an APR greater than zero.";
  if (apr > parseFixedDecimal("100")) return "Offer APR must be at most 100.";
  return undefined;
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
  offerApr,
}: {
  quote: Quote;
  marketId: string;
  chainId?: number;
  wallet?: string;
  offerApr: string;
}) {
  return [
    "Awakening Mock Offer",
    `chainId:${chainId ?? "<runtime config required>"}`,
    `wallet:${wallet?.toLowerCase() ?? "<wallet required>"}`,
    `marketId:${marketId.toLowerCase()}`,
    `amount:${formatFixedDecimal(parseFixedDecimal(quote.principal))}`,
    `apr:${formatFixedDecimal(parseFixedDecimal(offerApr))}`,
    `expiry:${quote.expiresAt}`,
  ].join("\n");
}
