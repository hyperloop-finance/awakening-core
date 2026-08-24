export type DataProfile = "mock" | "api";
export type QuoteSide = "BORROW" | "LEND";

export type MarketSummary = {
  id: string;
  label: string;
  collateralSymbol: "BTC";
  quoteSymbol: "USDC";
  strike: string;
  fixedApr: string;
  maturity: string;
  availableLiquidity: string;
  utilization: string;
  offerDepth: string;
  settlementState: "OPEN" | "MATURED" | "SETTLED";
  contractsReady: boolean;
};

export type Quote = {
  side: QuoteSide;
  principal: string;
  collateralRequired: string;
  interest: string;
  protocolFee: string;
  totalDue: string;
  totalPayout: string;
  apr: string;
  maturity: string;
  expiry: string;
  steps: string[];
};

export type PortfolioPosition = {
  id: string;
  side: QuoteSide;
  settlementState: "ACTIVE" | "MATURED" | "SETTLED";
  maturity: string;
  principal: string;
  marketId?: string;
  collateral?: string;
  payout?: string;
};

export type PortfolioPayload = {
  wallet: string;
  summary: { totalBorrowed: string; totalLent: string; activePositions: number };
  positions: PortfolioPosition[];
};

export type RuntimeConfig = {
  profile: DataProfile;
  chainId: number;
  rpcConfigured: boolean;
  awakeningAddress: string | null;
  settlementAddress: string | null;
  patAddress: string | null;
  optionVaultAddress: string | null;
  contractsReady: boolean;
};
