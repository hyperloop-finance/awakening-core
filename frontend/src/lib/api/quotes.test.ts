import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketDetail } from "./types";
import { mockQuote } from "./mock";
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
  fixedApr: "12.00",
  utilization: "41.20",
  availableLiquidity: "2500000.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
  collateralRatio: "1.500000",
  patCoverage: "100.20",
  minimumAmount: "1.000000",
};

beforeEach(() => vi.setSystemTime(new Date("2026-09-01T00:00:00Z")));
afterEach(() => vi.useRealTimers());

describe("buildQuote", () => {
  it.each([
    ["1000", "0.015", "120", "2.5", "1122.5"],
    ["2000", "0.03", "240", "5", "2245"],
  ])(
    "derives a BORROW quote for %s from market terms",
    (amount, collateral, interest, fee, total) => {
      const quote = buildQuote({ side: "BORROW", amount, market });

      expect(quote).toMatchObject({
        principal: amount,
        collateralRequirement: collateral,
        interest,
        protocolFee: fee,
        totalDueOrPayout: total,
      });
      expect(scaled(quote.totalDueOrPayout)).toBe(
        scaled(quote.principal) + scaled(quote.interest) + scaled(quote.protocolFee),
      );
    },
  );

  it("derives LEND payout and responds to market APR and collateral ratio", () => {
    const quote = buildQuote({ side: "LEND", amount: "1000", market });
    const changedMarket = { ...market, fixedApr: "18.00", collateralRatio: "2.000000" };
    const changed = buildQuote({ side: "LEND", amount: "1000", market: changedMarket });

    expect(quote.totalDueOrPayout).toBe("1117.5");
    expect(scaled(quote.totalDueOrPayout)).toBe(
      scaled(quote.principal) + scaled(quote.interest) - scaled(quote.protocolFee),
    );
    expect(changed.interest).toBe("180");
    expect(changed.collateralRequirement).toBe("0.02");
    expect(changed.totalDueOrPayout).toBe("1177.5");
  });

  it("keeps the default mock quote on the same calculation path", () => {
    const first = mockQuote(market, "BORROW", "1000");
    const second = mockQuote(market, "BORROW", "2000");

    expect(second).toMatchObject(buildQuote({ side: "BORROW", amount: "2000", market }));
    expect(second.collateralRequirement).not.toBe(first.collateralRequirement);
    expect(second.interest).not.toBe(first.interest);
    expect(second.protocolFee).not.toBe(first.protocolFee);
    expect(second.totalDueOrPayout).not.toBe(first.totalDueOrPayout);
    expect(scaled(second.totalDueOrPayout)).toBe(
      scaled(second.principal) + scaled(second.interest) + scaled(second.protocolFee),
    );
  });
});
