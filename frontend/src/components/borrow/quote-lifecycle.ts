import { validateDecimalInput } from "@/lib/api/quotes";
import type { MarketDetail } from "@/lib/api/types";

export function validateBorrowAmount(amount: string, minimum: string) {
  return validateDecimalInput(amount, minimum);
}

export function borrowDetails({
  minimumAmount,
  patCoverage,
  collateralRatio,
}: Pick<MarketDetail, "minimumAmount" | "patCoverage" | "collateralRatio">): [string, string][] {
  return [
    ["Minimum amount", `${minimumAmount} USDC`],
    ["Collateral ratio", `${collateralRatio}x`],
    ["PAT coverage", `${patCoverage}%`],
  ];
}
