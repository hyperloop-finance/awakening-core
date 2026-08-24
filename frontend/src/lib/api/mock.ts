import type { MarketSummary, PortfolioPayload, QuoteSide, RuntimeConfig } from "./types";

const MARKETS: MarketSummary[] = [
  {
    id: "btc-usdc-2026-12-15",
    label: "BTC / USDC · Dec 2026",
    collateralSymbol: "BTC",
    quoteSymbol: "USDC",
    strike: "80000",
    fixedApr: "12.00",
    maturity: "2026-12-15T00:00:00Z",
    availableLiquidity: "2500000.000000",
    utilization: "41.20",
    offerDepth: "18",
    settlementState: "OPEN",
    contractsReady: false,
  },
  {
    id: "btc-usdc-2027-03-15",
    label: "BTC / USDC · Mar 2027",
    collateralSymbol: "BTC",
    quoteSymbol: "USDC",
    strike: "75000",
    fixedApr: "14.50",
    maturity: "2027-03-15T00:00:00Z",
    availableLiquidity: "1800000.000000",
    utilization: "27.80",
    offerDepth: "11",
    settlementState: "OPEN",
    contractsReady: false,
  },
];

export const DEMO_WALLET = "0xdE00000000000000000000000000000000000001";

export function getMockMarketCatalog(): MarketSummary[] {
  return MARKETS.map((market) => ({ ...market }));
}

export function getMockPortfolio(wallet: string): PortfolioPayload {
  if (wallet.toLowerCase() !== DEMO_WALLET.toLowerCase()) {
    return { wallet, summary: { totalBorrowed: "0", totalLent: "0", activePositions: 0 }, positions: [] };
  }

  return {
    wallet,
    summary: { totalBorrowed: "12500.000000", totalLent: "8000.000000", activePositions: 2 },
    positions: [
      {
        id: "borrow-demo-1",
        side: "BORROW",
        settlementState: "ACTIVE",
        maturity: "2026-12-15T00:00:00Z",
        principal: "12500.000000",
        marketId: "btc-usdc-2026-12-15",
        collateral: "0.34722222",
      },
      {
        id: "lend-demo-1",
        side: "LEND",
        settlementState: "MATURED",
        maturity: "2026-06-15T00:00:00Z",
        principal: "8000.000000",
        marketId: "btc-usdc-2026-12-15",
        payout: "8236.712329",
      },
    ],
  };
}

export function getMockRuntimeConfig(): RuntimeConfig {
  return {
    profile: "mock",
    chainId: 31337,
    rpcConfigured: Boolean(process.env.NEXT_PUBLIC_ANVIL_RPC_URL),
    awakeningAddress: null,
    settlementAddress: null,
    patAddress: null,
    optionVaultAddress: null,
    contractsReady: false,
  };
}

export function getMockQuoteSideLabel(side: QuoteSide) {
  return side === "BORROW" ? "Borrow" : "Lend";
}
