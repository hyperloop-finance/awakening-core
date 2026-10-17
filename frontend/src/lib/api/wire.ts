import type {
  MarketDetail,
  MarketsResponse,
  Order,
  OrderSide,
  OrderStatus,
  Offer,
  PositionPayload,
  PositionSummary,
  PortfolioPayload,
  PortfolioPosition,
  Quote,
  QuoteSide,
  RuntimeConfig,
  SettlementState,
  SettlementAction,
  SettlementItem,
  SettlementPhase,
} from "./types";

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(label);
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(label);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(label);
  return value;
}

function enumeration<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(label);
  return value as T;
}

const evmAddress = /^0x[a-fA-F0-9]{40}$/;
const zeroAddress = /^0x0{40}$/i;

function optionalAddress(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !evmAddress.test(value) || zeroAddress.test(value)) {
    throw new Error(label);
  }
  return value;
}

function parseMarketSummary(value: unknown, label: string) {
  const market = object(value, label);
  return {
    id: text(market.id, label),
    collateralAsset: text(market.collateralAsset, label),
    principalAsset: text(market.principalAsset, label),
    maturity: text(market.maturity, label),
    fixedApr: text(market.fixedApr, label),
    utilization: text(market.utilization, label),
    availableLiquidity: text(market.availableLiquidity, label),
    offerDepth: text(market.offerDepth, label),
    settlementState: enumeration<SettlementState>(
      market.settlementState,
      ["OPEN", "MATURED", "SETTLED"],
      `${label} settlementState`,
    ),
    contractsReady: bool(market.contractsReady, label),
  };
}

export function parseMarketsResponse(value: unknown): MarketsResponse {
  const response = object(value, "MarketsResponse");
  const meta = object(response.meta, "MarketsResponse meta");
  if (!Array.isArray(response.data)) throw new Error("MarketsResponse");
  return {
    meta: {
      profile: text(meta.profile, "MarketsResponse profile"),
      chainId: integer(meta.chainId, "MarketsResponse chainId"),
      generatedAt: text(meta.generatedAt, "MarketsResponse generatedAt"),
      dataSource: enumeration(
        meta.dataSource,
        ["MOCK_CATALOG", "UNAVAILABLE"],
        "MarketsResponse dataSource",
      ),
    },
    data: response.data.map((market) => parseMarketSummary(market, "MarketsResponse")),
  };
}

export function parseMarketDetail(value: unknown): MarketDetail {
  const market = object(value, "MarketDetail");
  if (!Array.isArray(market.borrowLevels) || !Array.isArray(market.lendLevels)) throw new Error("MarketDetail levels");
  const level = (value: unknown) => { const item = object(value, "OrderBookLevel"); return { apr: text(item.apr, "OrderBookLevel apr"), availableAmount: text(item.availableAmount, "OrderBookLevel amount") }; };
  return {
    ...parseMarketSummary(market, "MarketDetail"),
    collateralRatio: text(market.collateralRatio, "MarketDetail collateralRatio"),
    patCoverage: text(market.patCoverage, "MarketDetail patCoverage"),
    strike: text(market.strike, "MarketDetail strike"),
    patStatus: enumeration(market.patStatus, ["VERIFIED_PREVIEW"], "MarketDetail patStatus"),
    patSource: enumeration(market.patSource, ["ATTESTED_CUSTODIAN_PREVIEW"], "MarketDetail patSource"),
    borrowLevels: market.borrowLevels.map(level),
    lendLevels: market.lendLevels.map(level),
    minimumAmount: text(market.minimumAmount, "MarketDetail minimumAmount"),
  };
}

const orderSides = ["BORROW", "LEND"] as const;
export function parseOrder(value: unknown): Order {
  const order = object(value, "Order");
  return { id: text(order.id, "Order id"), wallet: text(order.wallet, "Order wallet"), marketId: text(order.marketId, "Order marketId"), side: enumeration<OrderSide>(order.side, orderSides, "Order side"), amount: text(order.amount, "Order amount"), filledAmount: text(order.filledAmount, "Order filledAmount"), remainingAmount: text(order.remainingAmount, "Order remainingAmount"), apr: text(order.apr, "Order apr"), expiry: text(order.expiry, "Order expiry"), status: enumeration<OrderStatus>(order.status, ["OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "EXPIRED"], "Order status"), createdAt: text(order.createdAt, "Order createdAt") };
}
export const parseOrders = (value: unknown): Order[] => {
  if (!Array.isArray(value)) throw new Error("Orders");
  return value.map(parseOrder);
};

function parsePositionSummary(value: unknown): PositionSummary {
  const item = object(value, "PositionSummary");
  return { id: text(item.id, "Position id"), marketId: text(item.marketId, "Position marketId"), side: enumeration(item.side, orderSides, "Position side"), principal: text(item.principal, "Position principal"), collateral: text(item.collateral, "Position collateral"), creditUnits: text(item.creditUnits, "Position creditUnits"), debtUnits: text(item.debtUnits, "Position debtUnits"), faceValue: text(item.faceValue, "Position faceValue"), fixedApr: text(item.fixedApr, "Position fixedApr"), strike: text(item.strike, "Position strike"), patStatus: text(item.patStatus, "Position patStatus"), patCoverage: text(item.patCoverage, "Position patCoverage"), maturity: text(item.maturity, "Position maturity"), settlementState: enumeration(item.settlementState, ["OPEN", "MATURED", "SETTLED"], "Position settlementState") };
}
export function parsePositionPayload(value: unknown): PositionPayload {
  const payload = object(value, "PositionPayload"); const totals = object(payload.totals, "PositionTotals");
  if (!Array.isArray(payload.borrowPositions) || !Array.isArray(payload.lendPositions)) throw new Error("PositionPayload positions");
  return { wallet: text(payload.wallet, "Position wallet"), totals: { borrowedPrincipal: text(totals.borrowedPrincipal, "Position borrowedPrincipal"), lentPrincipal: text(totals.lentPrincipal, "Position lentPrincipal"), collateralLocked: text(totals.collateralLocked, "Position collateralLocked"), creditFaceValue: text(totals.creditFaceValue, "Position creditFaceValue"), debtOutstanding: text(totals.debtOutstanding, "Position debtOutstanding") }, borrowPositions: payload.borrowPositions.map(parsePositionSummary), lendPositions: payload.lendPositions.map(parsePositionSummary), profile: text(payload.profile, "Position profile"), asOf: text(payload.asOf, "Position asOf"), source: enumeration(payload.source, ["MOCK_CATALOG"], "Position source") };
}
export function parseSettlementItem(value: unknown): SettlementItem {
  const item = object(value, "SettlementItem"); if (!Array.isArray(item.availableActions)) throw new Error("Settlement actions");
  const actionValues = ["SIMULATE_REPAY_DEBT", "SIMULATE_RECOVER_COLLATERAL", "SIMULATE_CLAIM_LENDER_PAYOUT", "SIMULATE_CLAIM_RESIDUAL_PROCEEDS"] as const;
  return { positionId: text(item.positionId, "Settlement positionId"), marketId: text(item.marketId, "Settlement marketId"), side: enumeration(item.side, orderSides, "Settlement side"), maturity: text(item.maturity, "Settlement maturity"), phase: enumeration<SettlementPhase>(item.phase, ["PRE_MATURITY", "REPAYMENT_AVAILABLE", "READY_TO_CLAIM", "FINALIZED"], "Settlement phase"), outstandingDebt: text(item.outstandingDebt, "Settlement debt"), recoverableCollateral: text(item.recoverableCollateral, "Settlement collateral"), claimablePayout: text(item.claimablePayout, "Settlement payout"), claimableResidual: text(item.claimableResidual, "Settlement residual"), patStatus: text(item.patStatus, "Settlement PAT"), availableActions: item.availableActions.map((action) => enumeration<SettlementAction>(action, actionValues, "Settlement action")), simulated: bool(item.simulated, "Settlement simulated") };
}
export const parseSettlements = (value: unknown): SettlementItem[] => { if (!Array.isArray(value)) throw new Error("Settlements"); return value.map(parseSettlementItem); };

export function parseQuote(value: unknown): Quote {
  const quote = object(value, "Quote");
  if (!Array.isArray(quote.executionSteps)) throw new Error("Quote executionSteps");
  return {
    marketId: text(quote.marketId, "Quote marketId"),
    side: enumeration<QuoteSide>(quote.side, ["BORROW", "LEND"], "Quote side"),
    principal: text(quote.principal, "Quote principal"),
    collateralRequirement: text(
      quote.collateralRequirement,
      "Quote collateralRequirement",
    ),
    interest: text(quote.interest, "Quote interest"),
    protocolFee: text(quote.protocolFee, "Quote protocolFee"),
    totalDueOrPayout: text(quote.totalDueOrPayout, "Quote totalDueOrPayout"),
    apr: text(quote.apr, "Quote apr"),
    maturity: text(quote.maturity, "Quote maturity"),
    expiresAt: text(quote.expiresAt, "Quote expiresAt"),
    executionSteps: quote.executionSteps.map((step) => text(step, "Quote executionStep")),
  };
}

function parsePosition(value: unknown): PortfolioPosition {
  const position = object(value, "Portfolio position");
  return {
    id: text(position.id, "Portfolio position id"),
    marketId: text(position.marketId, "Portfolio position marketId"),
    side: enumeration<QuoteSide>(
      position.side,
      ["BORROW", "LEND"],
      "Portfolio position side",
    ),
    principal: text(position.principal, "Portfolio position principal"),
    collateral: text(position.collateral, "Portfolio position collateral"),
    maturity: text(position.maturity, "Portfolio position maturity"),
    settlementState: enumeration<SettlementState>(
      position.settlementState,
      ["OPEN", "MATURED", "SETTLED"],
      "Portfolio position settlementState",
    ),
  };
}

export function parsePortfolio(value: unknown): PortfolioPayload {
  const portfolio = object(value, "Portfolio");
  const totals = object(portfolio.totals, "Portfolio totals");
  const meta = object(portfolio.meta, "Portfolio meta");
  if (!Array.isArray(portfolio.borrowPositions) || !Array.isArray(portfolio.lendPositions)) {
    throw new Error("Portfolio positions");
  }
  return {
    wallet: text(portfolio.wallet, "Portfolio wallet"),
    meta: {
      profile: text(meta.profile, "Portfolio meta profile"),
      generatedAt: text(meta.generatedAt, "Portfolio meta generatedAt"),
      dataSource: enumeration(
        meta.dataSource,
        ["MOCK_CATALOG"],
        "Portfolio meta dataSource",
      ),
    },
    totals: {
      borrowedPrincipal: text(totals.borrowedPrincipal, "Portfolio borrowedPrincipal"),
      lentPrincipal: text(totals.lentPrincipal, "Portfolio lentPrincipal"),
      collateralLocked: text(totals.collateralLocked, "Portfolio collateralLocked"),
    },
    borrowPositions: portfolio.borrowPositions.map(parsePosition),
    lendPositions: portfolio.lendPositions.map(parsePosition),
  };
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  const config = object(value, "RuntimeConfig");
  return {
    profile: text(config.profile, "RuntimeConfig profile"),
    verificationStatus: config.verificationStatus == null ? undefined : text(config.verificationStatus, "RuntimeConfig verificationStatus"),
    transactionsEnabled: config.transactionsEnabled == null ? false : bool(config.transactionsEnabled, "RuntimeConfig transactionsEnabled"),
    ratifierAddress: optionalAddress(config.ratifierAddress, "RuntimeConfig ratifierAddress"),
    observedBlock: config.observedBlock == null ? undefined : integer(config.observedBlock, "RuntimeConfig observedBlock"),
    deploymentBlock: config.deploymentBlock == null ? undefined : integer(config.deploymentBlock, "RuntimeConfig deploymentBlock"),
    chainId: integer(config.chainId, "RuntimeConfig chainId"),
    rpcUrlConfigured: bool(config.rpcUrlConfigured, "RuntimeConfig rpcUrlConfigured"),
    contractsReady: bool(config.contractsReady, "RuntimeConfig contractsReady"),
    awakeningAddress: optionalAddress(
      config.awakeningAddress,
      "RuntimeConfig awakeningAddress",
    ),
    settlementAddress: optionalAddress(
      config.settlementAddress,
      "RuntimeConfig settlementAddress",
    ),
    patAddress: optionalAddress(config.patAddress, "RuntimeConfig patAddress"),
    optionVaultAddress: optionalAddress(
      config.optionVaultAddress,
      "RuntimeConfig optionVaultAddress",
    ),
  };
}

export function parseOffer(value: unknown): Offer {
  const offer = object(value, "Offer");
  return {
    signingScheme: enumeration(offer.signingScheme, ["EIP191_MOCK"], "Offer signingScheme"),
    wallet: text(offer.wallet, "Offer wallet"),
    marketId: text(offer.marketId, "Offer marketId"),
    amount: text(offer.amount, "Offer amount"),
    apr: text(offer.apr, "Offer apr"),
    expiry: text(offer.expiry, "Offer expiry"),
    signature: text(offer.signature, "Offer signature"),
    id: text(offer.id, "Offer id"),
    status: enumeration(offer.status, ["OPEN"], "Offer status"),
    createdAt: text(offer.createdAt, "Offer createdAt"),
  };
}
