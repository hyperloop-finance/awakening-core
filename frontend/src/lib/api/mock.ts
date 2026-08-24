import type { MarketDetail, PortfolioPayload, Quote, QuoteSide, RuntimeConfig } from "./types";
import { buildQuote } from "./quotes";

export const DEMO_WALLET = "0xde00000000000000000000000000000000000001";

const ids = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
];

const markets: MarketDetail[] = [
  {
    id: ids[0],
    collateralAsset: "BTC",
    principalAsset: "USDC",
    maturity: "2026-12-15T00:00:00Z",
    fixedApr: "12.00",
    utilization: "41.20",
    availableLiquidity: "2500000.000000",
    offerDepth: "18",
    settlementState: "OPEN",
    contractsReady: false,
    collateralRatio: "1.5000",
    patCoverage: "100.00",
    minimumAmount: "100.000000",
  },
  {
    id: ids[1],
    collateralAsset: "BTC",
    principalAsset: "USDC",
    maturity: "2027-03-15T00:00:00Z",
    fixedApr: "14.50",
    utilization: "27.80",
    availableLiquidity: "1800000.000000",
    offerDepth: "11",
    settlementState: "OPEN",
    contractsReady: false,
    collateralRatio: "1.5000",
    patCoverage: "100.00",
    minimumAmount: "100.000000",
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
        maturity: "2026-12-15T00:00:00Z",
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
