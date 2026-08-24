import type { MarketDetail, Quote, QuoteSide } from "./types";

const scale = BigInt(100_000_000);
const maximum = BigInt(1_000_000) * scale;

function parseScaled(value: string): bigint {
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * scale + BigInt(fraction.padEnd(8, "0"));
}

export function validateDecimalInput(
  value: string,
  minimum = "0",
): string | undefined {
  if (!/^\d+(\.\d+)?$/.test(value)) return "Use a plain decimal amount.";
  if ((value.split(".")[1]?.length ?? 0) > 8) return "Use at most 8 decimal places.";
  const amount = parseScaled(value);
  if (amount <= BigInt(0)) return "Enter an amount greater than zero.";
  if (amount > maximum) return "Amount must be at most 1000000.";
  if (amount < parseScaled(minimum)) return `Minimum amount is ${minimum}.`;
  return undefined;
}

export function buildQuote({
  side,
  amount,
  market,
}: {
  side: QuoteSide;
  amount: string;
  market: MarketDetail;
}): Quote {
  const error = validateDecimalInput(amount, market.minimumAmount);
  if (error) throw new Error(error);
  return {
    marketId: market.id,
    side,
    principal: amount,
    collateralRequirement: "0.01666667",
    interest: "24.657534",
    protocolFee: "2.500000",
    totalDueOrPayout: side === "BORROW" ? "1027.157534" : "1022.157534",
    apr: market.fixedApr,
    maturity: market.maturity,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    executionSteps: ["Review preview", "No on-chain transaction will be sent"],
  };
}
