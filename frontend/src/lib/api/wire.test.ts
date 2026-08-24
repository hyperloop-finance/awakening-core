import { describe, expect, it } from "vitest";
import {
  parseMarketsResponse,
  parseOffer,
  parsePortfolio,
  parseQuote,
  parseRuntimeConfig,
} from "./wire";

const market = {
  id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2026-12-15T00:00:00Z",
  fixedApr: "0.0850",
  utilization: "0.4200",
  availableLiquidity: "2500000.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
};

const quote = {
  marketId: market.id,
  side: "BORROW",
  principal: "100",
  collateralRequirement: "0.01",
  interest: "2",
  protocolFee: "1",
  totalDueOrPayout: "103",
  apr: "0.0850",
  maturity: "2026-12-15T00:00:00Z",
  expiresAt: "2026-08-24T01:00:00Z",
  executionSteps: ["preview"],
};

describe("OpenAPI wire adapters", () => {
  it("accepts the current MarketsResponse fixture and rejects legacy field names", () => {
    const response = parseMarketsResponse({
      data: [market],
      meta: {
        profile: "mock",
        chainId: 31337,
        generatedAt: "2026-01-01T00:00:00Z",
        dataSource: "MOCK_CATALOG",
      },
    });
    expect(response.data[0].collateralAsset).toBe("BTC");
    expect(response.meta.dataSource).toBe("MOCK_CATALOG");
    expect(() =>
      parseMarketsResponse({
        data: [{ ...market, collateralAsset: undefined, collateralSymbol: "BTC" }],
        meta: {},
      }),
    ).toThrow("MarketsResponse");
  });

  it("accepts quote, portfolio, config, and offer OpenAPI fixtures", () => {
    expect(parseQuote(quote).totalDueOrPayout).toBe("103");
    expect(
      parsePortfolio({
        wallet: "0x1111111111111111111111111111111111111111",
        meta: {
          profile: "mock",
          generatedAt: "2026-01-01T00:00:00Z",
          dataSource: "MOCK_CATALOG",
        },
        totals: { borrowedPrincipal: "1", lentPrincipal: "2", collateralLocked: "0.1" },
        borrowPositions: [],
        lendPositions: [],
      }).totals.lentPrincipal,
    ).toBe("2");
    expect(
      parseRuntimeConfig({
        profile: "mock",
        chainId: 31337,
        rpcUrlConfigured: false,
        contractsReady: false,
      }).rpcUrlConfigured,
    ).toBe(false);
    expect(
      parseOffer({
        signingScheme: "EIP191_MOCK",
        wallet: "0x1111111111111111111111111111111111111111",
        marketId: market.id,
        amount: "100",
        apr: "0.0850",
        expiry: "2026-08-25T00:00:00Z",
        signature: `0x${"1".repeat(130)}`,
        id: "offer-1",
        status: "OPEN",
        createdAt: "2026-08-24T00:00:00Z",
      }).status,
    ).toBe("OPEN");
  });

  it("rejects wire values outside the final OpenAPI enums and scalar types", () => {
    expect(() => parseQuote({ ...quote, side: "BUY" })).toThrow("Quote side");
    expect(() =>
      parseMarketsResponse({
        data: [market],
        meta: {
          profile: "mock",
          chainId: "31337",
          generatedAt: "2026-01-01T00:00:00Z",
          dataSource: "MOCK_CATALOG",
        },
      }),
    ).toThrow("MarketsResponse chainId");
    expect(() =>
      parseRuntimeConfig({
        profile: "mock",
        chainId: 31337,
        rpcUrlConfigured: false,
        contractsReady: true,
        awakeningAddress: `0x${"0".repeat(40)}`,
      }),
    ).toThrow("RuntimeConfig awakeningAddress");
  });
});
