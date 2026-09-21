import type { MarketDetail, Quote, QuoteSide } from "./types";
import {
  FIXED_DECIMAL_SCALE,
  formatFixedDecimal,
  parseFixedDecimal,
} from "../fixed-decimal";

const maximum = BigInt(1_000_000) * FIXED_DECIMAL_SCALE;
const protocolFeeBasisPoints = BigInt(30);
const basisPointDenominator = BigInt(10_000);
const millisecondsPerYear = BigInt(365 * 24 * 60 * 60 * 1000);
const sixDecimalFactor = BigInt(100);

// Temporary mock-contract parity with backend QuoteService. API quotes replace this path
// outside the mock profile; keep these terms synchronized until then.
function divideHalfUp(numerator: bigint, denominator: bigint) {
  const negative = numerator < BigInt(0);
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute + denominator / BigInt(2)) / denominator;
  return negative ? -rounded : rounded;
}

function formatUnits(value: bigint, decimalPlaces: number) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const unit = BigInt(`1${"0".repeat(decimalPlaces)}`);
  const integer = absolute / unit;
  const fraction = (absolute % unit).toString().padStart(decimalPlaces, "0");
  return `${negative ? "-" : ""}${integer}.${fraction}`;
}

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
  const termMilliseconds = BigInt(new Date(market.maturity).getTime() - now.getTime());
  if (termMilliseconds <= BigInt(0)) throw new Error("Quotes are unavailable after market maturity.");
  // QuoteService exposes APR as a decimal rate (0.085 = 8.5%), not percentage points.
  const apr = parseFixedDecimal(market.fixedApr);
  const interestNumerator = principal * apr * termMilliseconds;
  const interestDenominator = FIXED_DECIMAL_SCALE * millisecondsPerYear;
  const feeNumerator = principal * protocolFeeBasisPoints;
  const interest = divideHalfUp(
    interestNumerator,
    interestDenominator * sixDecimalFactor,
  );
  const protocolFee = divideHalfUp(
    feeNumerator,
    basisPointDenominator * sixDecimalFactor,
  );
  const commonDenominator = interestDenominator * basisPointDenominator;
  const totalNumerator =
    principal * commonDenominator +
    interestNumerator * basisPointDenominator +
    (side === "BORROW"
      ? feeNumerator * interestDenominator
      : -(feeNumerator * interestDenominator));
  const total = divideHalfUp(
    totalNumerator,
    commonDenominator * sixDecimalFactor,
  );
  const collateral =
    side === "BORROW"
      ? divideHalfUp(
          principal * parseFixedDecimal(market.collateralRatio),
          parseFixedDecimal(market.strike),
        )
      : BigInt(0);
  return {
    marketId: market.id,
    side,
    principal: formatFixedDecimal(principal),
    collateralRequirement: formatUnits(collateral, 8),
    interest: formatUnits(interest, 6),
    protocolFee: formatUnits(protocolFee, 6),
    totalDueOrPayout: formatUnits(total, 6),
    apr: market.fixedApr,
    maturity: market.maturity,
    expiresAt: new Date(now.getTime() + 300_000).toISOString(),
    executionSteps:
      side === "BORROW"
        ? [
            `Review ${market.collateralAsset} collateral requirement`,
            "Sign simulated borrow intent",
            `Receive ${market.principalAsset} principal`,
          ]
        : [
            "Review fixed-rate offer",
            "Sign simulated lend offer",
            `Reserve ${market.principalAsset} liquidity`,
          ],
  };
}
