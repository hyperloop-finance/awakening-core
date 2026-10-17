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
  strike: string;
  patStatus: "VERIFIED_PREVIEW";
  patSource: "ATTESTED_CUSTODIAN_PREVIEW";
  borrowLevels: OrderBookLevel[];
  lendLevels: OrderBookLevel[];
  minimumAmount: string;
};

export type OrderBookLevel = { apr: string; availableAmount: string };
export type OrderSide = "BORROW" | "LEND";
export type OrderStatus = "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "EXPIRED";
export type CreateOrderInput = { wallet: string; marketId: string; side: OrderSide; amount: string; apr: string; expiry: string };
export type Order = CreateOrderInput & { id: string; filledAmount: string; remainingAmount: string; status: OrderStatus; createdAt: string };

export type PositionSummary = {
  id: string; marketId: string; side: OrderSide; principal: string; collateral: string;
  creditUnits: string; debtUnits: string; faceValue: string; fixedApr: string; strike: string;
  patStatus: string; patCoverage: string; maturity: string; settlementState: SettlementState;
};
export type PositionPayload = {
  wallet: string;
  totals: { borrowedPrincipal: string; lentPrincipal: string; collateralLocked: string; creditFaceValue: string; debtOutstanding: string };
  borrowPositions: PositionSummary[]; lendPositions: PositionSummary[]; profile: string; asOf: string; source: "MOCK_CATALOG";
};
export type SettlementPhase = "PRE_MATURITY" | "REPAYMENT_AVAILABLE" | "READY_TO_CLAIM" | "FINALIZED";
export type SettlementAction = "SIMULATE_REPAY_DEBT" | "SIMULATE_RECOVER_COLLATERAL" | "SIMULATE_CLAIM_LENDER_PAYOUT" | "SIMULATE_CLAIM_RESIDUAL_PROCEEDS";
export type SettlementItem = { positionId: string; marketId: string; side: OrderSide; maturity: string; phase: SettlementPhase; outstandingDebt: string; recoverableCollateral: string; claimablePayout: string; claimableResidual: string; patStatus: string; availableActions: SettlementAction[]; simulated: boolean };

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
  ratifierAddress?: string | null;
  deploymentBlock?: number;
  observedBlock?: number;
  verificationStatus?: string;
  transactionsEnabled?: boolean;
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
