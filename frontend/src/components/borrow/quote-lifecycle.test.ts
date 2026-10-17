import { describe, expect, it } from "vitest";
import { borrowDetails, validateBorrowAmount } from "./quote-lifecycle";

describe("borrow quote lifecycle", () => {
  it("enforces market minimum and amount bounds", () => {
    expect(validateBorrowAmount("99", "100")).toBe("Minimum amount is 100.");
    expect(validateBorrowAmount("100.000000001", "100")).toBe(
      "Use at most 8 decimal places.",
    );
    expect(validateBorrowAmount("1000000.00000001", "100")).toBe(
      "Amount must be at most 1000000.",
    );
    expect(validateBorrowAmount("000000000000000000000100", "100")).toBeUndefined();
  });

  it("maps PAT and collateral information", () => {
    expect(
      borrowDetails({ minimumAmount: "100", patCoverage: "0.95", collateralRatio: "1.66", principalAsset: "USDC" }),
    ).toContainEqual(["PAT coverage", "95%"]);
  });
});
