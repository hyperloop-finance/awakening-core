import { describe, expect, it } from "vitest";
import { parseMarketsResponse, parsePortfolio, parseQuote, parseRuntimeConfig } from "./wire";

const market = { id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", collateralAsset: "BTC", principalAsset: "USDC", maturity: "2026-12-15T00:00:00Z", fixedApr: "12.00", utilization: "41.20", availableLiquidity: "2500000.000000", offerDepth: "18", settlementState: "OPEN", contractsReady: false };

describe("OpenAPI wire adapters", () => {
  it("accepts the current MarketsResponse fixture and rejects legacy field names", () => {
    expect(parseMarketsResponse({ data: [market], meta: { profile: "mock", chainId: 31337, generatedAt: "2026-01-01T00:00:00Z" } }).data[0].collateralAsset).toBe("BTC");
    expect(() => parseMarketsResponse({ data: [{ ...market, collateralAsset: undefined, collateralSymbol: "BTC" }], meta: {} })).toThrow("MarketsResponse");
  });
  it("accepts quote, portfolio and config OpenAPI fixtures", () => {
    expect(parseQuote({ marketId: market.id, side: "BORROW", principal: "100", collateralRequirement: "0.01", interest: "2", protocolFee: "1", totalDueOrPayout: "103", apr: "12", maturity: "2026-12-15T00:00:00Z", expiresAt: "2026-08-24T01:00:00Z", executionSteps: ["preview"] }).totalDueOrPayout).toBe("103");
    expect(parsePortfolio({ wallet: "0x1111111111111111111111111111111111111111", totals: { borrowedPrincipal: "1", lentPrincipal: "2", collateralLocked: "0.1" }, borrowPositions: [], lendPositions: [] }).totals.lentPrincipal).toBe("2");
    expect(parseRuntimeConfig({ profile: "mock", chainId: 31337, rpcUrlConfigured: false, contractsReady: false }).rpcUrlConfigured).toBe(false);
  });
});
