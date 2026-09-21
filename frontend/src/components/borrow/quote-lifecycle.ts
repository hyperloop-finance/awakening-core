import { validateDecimalInput } from "@/lib/api/quotes";
import type { MarketDetail } from "@/lib/api/types";
import { formatRateAsPercent } from "@/lib/fixed-decimal";

export function validateBorrowAmount(amount: string, minimum: string) {
  return validateDecimalInput(amount, minimum);
}

export function borrowDetails({
  minimumAmount,
  patCoverage,
  collateralRatio,
  principalAsset,
}: Pick<MarketDetail, "minimumAmount" | "patCoverage" | "collateralRatio" | "principalAsset">): [string, string][] {
  return [
    ["Minimum amount", `${minimumAmount} ${principalAsset}`],
    ["Collateral ratio", `${collateralRatio}x`],
    ["PAT coverage", formatRateAsPercent(patCoverage)],
  ];
}
