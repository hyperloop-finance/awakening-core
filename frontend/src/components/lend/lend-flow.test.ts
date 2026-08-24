import { describe, expect, it } from "vitest";
import { canPreviewOffer, offerSummary, validateOfferInput } from "./lend-flow";

describe("lend offer flow", () => {
  it("validates plain positive amount and APR", () => {
    expect(validateOfferInput("0", "12")).toBe("Enter an amount greater than zero.");
    expect(validateOfferInput("100", "0")).toBe("Enter an APR greater than zero.");
    expect(validateOfferInput("100.000000001", "12")).toBe("Use at most 8 decimal places.");
    expect(validateOfferInput("1000001", "12")).toBe("Values must be at most 1000000.");
    expect(validateOfferInput("000000000000000000000100", "12")).toBeUndefined();
    expect(validateOfferInput("0.1", "0.1")).toBeUndefined();
  });
  it("requires validation and preview before a simulated offer", () => {
    expect(canPreviewOffer({ error: undefined, previewed: false })).toBe(false);
    expect(canPreviewOffer({ error: undefined, previewed: true })).toBe(true);
  });
  it("maps PAT and offer details without enabling live signing", () => {
    expect(offerSummary({ amount: "1000", apr: "12", patCoverage: "100.00" })).toContainEqual(["PAT coverage", "100.00%"]);
  });
});
