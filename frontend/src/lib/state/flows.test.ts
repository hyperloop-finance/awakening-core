import { describe, expect, it } from "vitest";

import { canSimulateSubmit, derivePortfolioView, filterMarkets, quoteSummary } from "./flows";
import { getMockMarketCatalog } from "../api/mock";

describe("market filtering", () => {
  it("finds BTC markets by id and returns no matches for another collateral", () => {
    expect(filterMarkets(getMockMarketCatalog(), "2026")).not.toHaveLength(0);
    expect(filterMarkets(getMockMarketCatalog(), "ETH")).toHaveLength(0);
  });
});

describe("quote state", () => {
  it("requires a valid amount and an explicit preview before simulated submission", () => {
    expect(canSimulateSubmit({ amountError: undefined, previewed: false })).toBe(false);
    expect(canSimulateSubmit({ amountError: "Use a plain decimal amount.", previewed: true })).toBe(false);
    expect(canSimulateSubmit({ amountError: undefined, previewed: true })).toBe(true);
  });

  it("maps a borrow quote into the labelled preview rows", () => {
    const rows = quoteSummary({
      side: "BORROW",
      principal: "1000.000000",
      collateralRequired: "0.01666667",
      interest: "24.657534",
      protocolFee: "2.500000",
      totalDue: "1027.157534",
      totalPayout: "1000.000000",
      apr: "12.00",
      maturity: "2026-12-15T00:00:00Z",
      expiry: "2026-08-24T01:00:00Z",
      steps: ["Approve BTC collateral", "Create simulated borrow"],
    });

    expect(rows).toContainEqual(["BTC collateral", "0.01666667 BTC"]);
    expect(rows).toContainEqual(["Total due at maturity", "1,027.157534 USDC"]);
  });
});

describe("portfolio state", () => {
  it("separates populated borrowing and lending positions and marks matured positions", () => {
    const view = derivePortfolioView({
      wallet: "0xdemo",
      summary: { totalBorrowed: "1000", totalLent: "500", activePositions: 2 },
      positions: [
        { id: "b1", side: "BORROW", settlementState: "ACTIVE", maturity: "2027-01-01T00:00:00Z", principal: "1000" },
        { id: "l1", side: "LEND", settlementState: "MATURED", maturity: "2026-01-01T00:00:00Z", principal: "500" },
      ],
    });

    expect(view.kind).toBe("populated");
    expect(view.borrows).toHaveLength(1);
    expect(view.lends[0].status).toBe("Matured — settlement available");
  });

  it("returns disconnected, empty, and error recovery states", () => {
    expect(derivePortfolioView(undefined).kind).toBe("disconnected");
    expect(derivePortfolioView({ wallet: "0xdemo", summary: { totalBorrowed: "0", totalLent: "0", activePositions: 0 }, positions: [] }).kind).toBe("empty");
    expect(derivePortfolioView({ error: "API unavailable" }).kind).toBe("error");
  });
});
