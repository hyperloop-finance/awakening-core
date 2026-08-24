import { describe, expect, it } from "vitest";
import type { MarketDetail, Quote } from "./types";
import { getMockMarketCatalog, mockQuote } from "./mock";
import { buildQuote } from "./quotes";

const scale = BigInt(100_000_000);

function scaled(value: string) {
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * scale + BigInt(fraction.padEnd(8, "0"));
}

const market: MarketDetail = {
  id: `0x${"a".repeat(64)}`,
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2027-09-01T00:00:00Z",
  fixedApr: "0.0850",
  utilization: "41.20",
  availableLiquidity: "2500000.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
  collateralRatio: "1.500000",
  patCoverage: "100.20",
  minimumAmount: "1.000000",
};

function accountingFields(quote: Quote) {
  return {
    principal: quote.principal,
    collateralRequirement: quote.collateralRequirement,
    interest: quote.interest,
    protocolFee: quote.protocolFee,
    totalDueOrPayout: quote.totalDueOrPayout,
  };
}

describe("buildQuote backend parity", () => {
  it("matches the published QuoteService BORROW fixture at a 0.0850 decimal rate", () => {
    const quote = buildQuote({ side: "BORROW", amount: "1000", market });

    expect(accountingFields(quote)).toEqual({
      principal: "1000",
      collateralRequirement: "0.02500000",
      interest: "20.958904",
      protocolFee: "3.000000",
      totalDueOrPayout: "1023.958904",
    });
    expect(scaled(quote.totalDueOrPayout)).toBe(
      scaled(quote.principal) + scaled(quote.interest) + scaled(quote.protocolFee),
    );
  });

  it("matches the QuoteService LEND literal fixture for the same principal", () => {
    const quote = buildQuote({ side: "LEND", amount: "1000", market });

    expect(accountingFields(quote)).toEqual({
      principal: "1000",
      collateralRequirement: "0.00000000",
      interest: "20.958904",
      protocolFee: "3.000000",
      totalDueOrPayout: "1017.958904",
    });
    expect(scaled(quote.totalDueOrPayout)).toBe(
      scaled(quote.principal) + scaled(quote.interest) - scaled(quote.protocolFee),
    );
  });

  it("scales every accounting field for a second amount with literal rounding", () => {
    expect(accountingFields(buildQuote({ side: "BORROW", amount: "2000", market }))).toEqual({
      principal: "2000",
      collateralRequirement: "0.05000000",
      interest: "41.917808",
      protocolFee: "6.000000",
      totalDueOrPayout: "2047.917808",
    });
  });

  it("keeps numeric quote terms independent of the wall clock", () => {
    const early = buildQuote({
      side: "BORROW",
      amount: "1000",
      market,
      now: new Date("2025-01-01T00:00:00Z"),
    });
    const late = buildQuote({
      side: "BORROW",
      amount: "1000",
      market,
      now: new Date("2030-01-01T00:00:00Z"),
    });

    expect(accountingFields(late)).toEqual(accountingFields(early));
  });

  it("matches the backend five-minute expiry and side-specific preview steps", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const borrow = buildQuote({ side: "BORROW", amount: "1000", market, now });
    const lend = buildQuote({ side: "LEND", amount: "1000", market, now });

    expect(borrow.expiresAt).toBe("2026-09-01T00:05:00.000Z");
    expect(borrow.executionSteps).toEqual([
      "Review BTC collateral requirement",
      "Sign simulated borrow intent",
      "Receive USDC principal",
    ]);
    expect(lend.executionSteps).toEqual([
      "Review fixed-rate offer",
      "Sign simulated lend offer",
      "Reserve USDC liquidity",
    ]);
  });

  it("keeps the default mock quote on the parity calculation path", () => {
    expect(accountingFields(mockQuote(market, "BORROW", "1000"))).toEqual({
      principal: "1000",
      collateralRequirement: "0.02500000",
      interest: "20.958904",
      protocolFee: "3.000000",
      totalDueOrPayout: "1023.958904",
    });
  });

  it("mirrors the backend public market fixture in the default mock catalog", () => {
    expect(getMockMarketCatalog()).toEqual([
      {
        id: "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6",
        collateralAsset: "BTC",
        principalAsset: "USDC",
        maturity: "2026-12-31T00:00:00Z",
        fixedApr: "0.0850",
        utilization: "0.4200",
        availableLiquidity: "250000.00",
        offerDepth: "175000.00",
        settlementState: "OPEN",
        contractsReady: false,
        collateralRatio: "1.5000",
        patCoverage: "0.9500",
        minimumAmount: "100.00",
      },
    ]);
  });
});
