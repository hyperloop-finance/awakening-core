import type { MarketDetail, Quote, QuoteSide } from "./types";
import {
  FIXED_DECIMAL_SCALE,
  formatFixedDecimal,
  parseFixedDecimal,
} from "../fixed-decimal";

const maximum = BigInt(1_000_000) * FIXED_DECIMAL_SCALE;
const percent = BigInt(100) * FIXED_DECIMAL_SCALE;
const protocolFeeBasisPoints = BigInt(25);
const basisPointDenominator = BigInt(10_000);
const secondsPerYear = BigInt(365 * 24 * 60 * 60);
const mockBtcReferencePrice = parseFixedDecimal("100000");

export function validateDecimalInput(
  value: string,
  minimum = "0",
): string | undefined {
  if (!/^\d+(\.\d+)?$/.test(value)) return "Use a plain decimal amount.";
  if ((value.split(".")[1]?.length ?? 0) > 8) return "Use at most 8 decimal places.";
  const amount = parseFixedDecimal(value);
  if (amount <= BigInt(0)) return "Enter an amount greater than zero.";
  if (amount > maximum) return "Amount must be at most 1000000.";
  if (amount < parseFixedDecimal(minimum)) return `Minimum amount is ${minimum}.`;
  return undefined;
}

export function buildQuote({
  side,
  amount,
  market,
  now = new Date(),
}: {
  side: QuoteSide;
  amount: string;
  market: MarketDetail;
  now?: Date;
}): Quote {
  const error = validateDecimalInput(amount, market.minimumAmount);
  if (error) throw new Error(error);
  const principal = parseFixedDecimal(amount);
  const apr = parseFixedDecimal(market.fixedApr);
  const collateralRatio = parseFixedDecimal(market.collateralRatio);
  const maturitySeconds = BigInt(Math.floor(Date.parse(market.maturity) / 1000));
  const nowSeconds = BigInt(Math.floor(now.getTime() / 1000));
  const termSeconds = maturitySeconds > nowSeconds ? maturitySeconds - nowSeconds : BigInt(0);
  const collateral = (principal * collateralRatio) / mockBtcReferencePrice;
  const interest = (principal * apr * termSeconds) / (percent * secondsPerYear);
  const protocolFee = (principal * protocolFeeBasisPoints) / basisPointDenominator;
  const total =
    side === "BORROW"
      ? principal + interest + protocolFee
      : principal + interest - protocolFee;
  return {
    marketId: market.id,
    side,
    principal: formatFixedDecimal(principal),
    collateralRequirement: formatFixedDecimal(collateral),
    interest: formatFixedDecimal(interest),
    protocolFee: formatFixedDecimal(protocolFee),
    totalDueOrPayout: formatFixedDecimal(total),
    apr: market.fixedApr,
    maturity: market.maturity,
    expiresAt: new Date(now.getTime() + 600_000).toISOString(),
    executionSteps: ["Review preview", "No on-chain transaction will be sent"],
  };
}
