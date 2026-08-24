import { describe, expect, it } from "vitest";

import { normalizeApiError } from "./client";
import { getMockMarketCatalog } from "./mock";
import { resolveDataProfile } from "./profile";
import { buildQuote, validateDecimalInput } from "./quotes";

describe("data profile selection", () => {
  it("defaults an absent or invalid setting to mock so the app stays runnable", () => {
    expect(resolveDataProfile(undefined)).toBe("mock");
    expect(resolveDataProfile("unknown")).toBe("mock");
    expect(resolveDataProfile("api")).toBe("api");
  });
});

describe("the deterministic mock catalog", () => {
  it("contains only BTC collateral markets and decimal-string financial fields", () => {
    const catalog = getMockMarketCatalog();

    expect(catalog).not.toHaveLength(0);
    expect(catalog.every((market) => market.collateralSymbol === "BTC")).toBe(true);
    expect(catalog.every((market) => /^\d+(\.\d+)?$/.test(market.fixedApr))).toBe(true);
    expect(catalog.every((market) => /^\d+(\.\d+)?$/.test(market.availableLiquidity))).toBe(true);
  });
});

describe("quote calculations", () => {
  it("preserves six decimal places for a BTC borrow quote", () => {
    const quote = buildQuote({
      side: "BORROW",
      amount: "1000.123456",
      market: getMockMarketCatalog()[0],
    });

    expect(quote.principal).toBe("1000.123456");
    expect(quote.totalDue).toMatch(/^\d+\.\d{6}$/);
    expect(quote.collateralRequired).toMatch(/^\d+\.\d{8}$/);
  });

  it("rejects zero, negative, malformed, and over-precision decimal input", () => {
    expect(validateDecimalInput("0")).toBe("Enter an amount greater than zero.");
    expect(validateDecimalInput("-0.1")).toBe("Enter an amount greater than zero.");
    expect(validateDecimalInput("1e3")).toBe("Use a plain decimal amount.");
    expect(validateDecimalInput("1.1234567")).toBe("Use at most 6 decimal places.");
    expect(validateDecimalInput("1.123456")).toBeUndefined();
  });
});

describe("API error normalization", () => {
  it("uses RFC 9457 detail when supplied and a recoverable fallback otherwise", () => {
    expect(normalizeApiError({ detail: "Market unavailable", status: 404 })).toEqual({
      message: "Market unavailable",
      status: 404,
    });
    expect(normalizeApiError(null)).toEqual({
      message: "Unable to reach the Awakening API. Check the API URL and try again.",
      status: undefined,
    });
  });
});
