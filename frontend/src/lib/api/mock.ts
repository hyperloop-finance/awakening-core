import type { MarketDetail, PortfolioPayload, Quote, QuoteSide, RuntimeConfig } from "./types";
import { buildQuote } from "./quotes";

export const DEMO_WALLET = "0xde00000000000000000000000000000000000001";

const ids = [
  "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6",
];

// Temporary contract parity: keep this fallback identical to MarketService until the API replaces it.
const markets: MarketDetail[] = [
  {
    id: ids[0],
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
];

export const getMockMarketCatalog = () => markets.map((market) => ({ ...market }));

export const getMockMarket = (id: string) =>
  getMockMarketCatalog().find((market) => market.id === id);

export function getMockPortfolio(wallet: string): PortfolioPayload {
  const meta = {
    profile: "mock",
    generatedAt: new Date().toISOString(),
    dataSource: "MOCK_CATALOG" as const,
  };
  if (wallet !== DEMO_WALLET) {
    return {
      wallet,
      meta,
      totals: { borrowedPrincipal: "0", lentPrincipal: "0", collateralLocked: "0" },
      borrowPositions: [],
      lendPositions: [],
    };
  }
  return {
    wallet,
    meta,
    totals: {
      borrowedPrincipal: "12500.000000",
      lentPrincipal: "8000.000000",
      collateralLocked: "0.34722222",
    },
    borrowPositions: [
      {
        id: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        marketId: ids[0],
        side: "BORROW",
        principal: "12500.000000",
        collateral: "0.34722222",
        maturity: "2026-12-31T00:00:00Z",
        settlementState: "OPEN",
      },
    ],
    lendPositions: [
      {
        id: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        marketId: ids[0],
        side: "LEND",
        principal: "8000.000000",
        collateral: "0",
        maturity: "2026-06-15T00:00:00Z",
        settlementState: "MATURED",
      },
    ],
  };
}

export const getMockRuntimeConfig = (): RuntimeConfig => ({
  profile: "mock",
  chainId: 31337,
  rpcUrlConfigured: Boolean(process.env.NEXT_PUBLIC_ANVIL_RPC_URL),
  contractsReady: false,
  awakeningAddress: null,
  settlementAddress: null,
  patAddress: null,
  optionVaultAddress: null,
});

export const mockQuote = (
  market: MarketDetail,
  side: QuoteSide,
  amount: string,
): Quote => buildQuote({ market, side, amount });
