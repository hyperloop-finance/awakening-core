import type { MarketSummary, Quote, QuoteSide } from "./types";

const AMOUNT_SCALE = 1_000_000;
const BTC_SCALE = 100_000_000;
const BTC_PRICE_USDC = 60_000;
const COLLATERALIZATION = 0.6;
const PROTOCOL_FEE_RATE = 0.0025;
const TERM_DAYS = 90;

function formatScaled(value: number, scale: number, digits: number) {
  return (Math.round((value + Number.EPSILON) * scale) / scale).toFixed(digits);
}

export function validateDecimalInput(value: string): string | undefined {
  if (/^-\d+(\.\d+)?$/.test(value) || value === "0") return "Enter an amount greater than zero.";
  if (!/^\d+(\.\d+)?$/.test(value)) return "Use a plain decimal amount.";
  if (Number(value) <= 0) return "Enter an amount greater than zero.";
  if ((value.split(".")[1]?.length ?? 0) > 6) return "Use at most 6 decimal places.";
  return undefined;
}

export function buildQuote({ side, amount, market }: { side: QuoteSide; amount: string; market: MarketSummary }): Quote {
  const validationError = validateDecimalInput(amount);
  if (validationError) throw new Error(validationError);

  const principal = Math.round(Number(amount) * AMOUNT_SCALE) / AMOUNT_SCALE;
  const apr = Number(market.fixedApr) / 100;
  const interest = principal * apr * (TERM_DAYS / 365);
  const fee = principal * PROTOCOL_FEE_RATE;
  const collateral = principal / BTC_PRICE_USDC / COLLATERALIZATION;
  const formattedPrincipal = formatScaled(principal, AMOUNT_SCALE, 6);
  const formattedInterest = formatScaled(interest, AMOUNT_SCALE, 6);
  const formattedFee = formatScaled(fee, AMOUNT_SCALE, 6);

  return {
    side,
    principal: formattedPrincipal,
    collateralRequired: formatScaled(collateral, BTC_SCALE, 8),
    interest: formattedInterest,
    protocolFee: formattedFee,
    totalDue: formatScaled(principal + interest + fee, AMOUNT_SCALE, 6),
    totalPayout: formatScaled(principal + interest - fee, AMOUNT_SCALE, 6),
    apr: market.fixedApr,
    maturity: market.maturity,
    expiry: new Date(Date.now() + 10 * 60_000).toISOString(),
    steps:
      side === "BORROW"
        ? ["Review BTC collateral requirement", "Preview simulated borrow", "No on-chain transaction will be sent"]
        : ["Review lend payout and PAT coverage", "Preview simulated signing", "No offer will be published on-chain"],
  };
}
