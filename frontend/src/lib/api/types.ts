export type DataProfile = "mock" | "api";
export type QuoteSide = "BORROW" | "LEND";
export type SettlementState = "OPEN" | "MATURED" | "SETTLED";
export type MarketDataSource = "MOCK_CATALOG" | "UNAVAILABLE";

export type MarketSummary = {
  id: string;
  collateralAsset: string;
  principalAsset: string;
  maturity: string;
  fixedApr: string;
  utilization: string;
  availableLiquidity: string;
  offerDepth: string;
  settlementState: SettlementState;
  contractsReady: boolean;
};

export type MarketDetail = MarketSummary & {
  collateralRatio: string;
  patCoverage: string;
  minimumAmount: string;
};

export type MarketMeta = {
  profile: string;
  chainId: number;
  generatedAt: string;
  dataSource: MarketDataSource;
};

export type MarketsResponse = { data: MarketSummary[]; meta: MarketMeta };

export type Quote = {
  marketId: string;
  side: QuoteSide;
  principal: string;
  collateralRequirement: string;
  interest: string;
  protocolFee: string;
  totalDueOrPayout: string;
  apr: string;
  maturity: string;
  expiresAt: string;
  executionSteps: string[];
};

export type PortfolioPosition = {
  id: string;
  marketId: string;
  side: QuoteSide;
  principal: string;
  collateral: string;
  maturity: string;
  settlementState: SettlementState;
};

export type PortfolioPayload = {
  wallet: string;
  totals: {
    borrowedPrincipal: string;
    lentPrincipal: string;
    collateralLocked: string;
  };
  borrowPositions: PortfolioPosition[];
  lendPositions: PortfolioPosition[];
  meta: {
    profile: string;
    generatedAt: string;
    dataSource: "MOCK_CATALOG";
  };
};

export type RuntimeConfig = {
  profile: string;
  chainId: number;
  rpcUrlConfigured: boolean;
  contractsReady: boolean;
  awakeningAddress?: string | null;
  settlementAddress?: string | null;
  patAddress?: string | null;
  optionVaultAddress?: string | null;
};

export type SignedOffer = {
  signingScheme: "EIP191_MOCK";
  wallet: string;
  marketId: string;
  amount: string;
  apr: string;
  expiry: string;
  signature: string;
};

export type Offer = SignedOffer & {
  id: string;
  status: "OPEN";
  createdAt: string;
};
