import type { MarketDetail, Quote } from "@/lib/api/types";
import {
  formatFixedDecimal,
  formatRateAsPercent,
  parseFixedDecimal,
  percentToDecimalRate,
} from "@/lib/fixed-decimal";

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
  if ((value.split(".")[1]?.length ?? 0) > 6) {
    return "Use at most 6 decimal places.";
  }
  const apr = parseFixedDecimal(value);
  if (apr <= BigInt(0)) return "Enter an APR greater than zero.";
  if (apr > parseFixedDecimal("100")) return "Offer APR must be at most 100.";
  return undefined;
}

export function lendDetails(market: MarketDetail): [string, string][] {
  return [
    ["Minimum amount", `${market.minimumAmount} ${market.principalAsset}`],
    ["Fixed APR", formatRateAsPercent(market.fixedApr)],
    ["PAT coverage", formatRateAsPercent(market.patCoverage)],
  ];
}

export function buildUnsignedOfferPayload({
  quote,
  marketId,
  chainId,
  wallet,
  offerAprPercent,
}: {
  quote: Quote;
  marketId: string;
  chainId?: number;
  wallet?: string;
  offerAprPercent: string;
}) {
  return [
    "Awakening Mock Offer",
    `chainId:${chainId ?? "<runtime config required>"}`,
    `wallet:${wallet?.toLowerCase() ?? "<wallet required>"}`,
    `marketId:${marketId.toLowerCase()}`,
    `amount:${formatFixedDecimal(parseFixedDecimal(quote.principal))}`,
    `apr:${percentToDecimalRate(offerAprPercent)}`,
    `expiry:${quote.expiresAt}`,
  ].join("\n");
}
