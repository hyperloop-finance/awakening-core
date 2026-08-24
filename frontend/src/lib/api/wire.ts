import type {
  MarketDetail,
  MarketsResponse,
  Offer,
  PortfolioPayload,
  PortfolioPosition,
  Quote,
  QuoteSide,
  RuntimeConfig,
  SettlementState,
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
  return {
    ...parseMarketSummary(market, "MarketDetail"),
    collateralRatio: text(market.collateralRatio, "MarketDetail collateralRatio"),
    patCoverage: text(market.patCoverage, "MarketDetail patCoverage"),
    minimumAmount: text(market.minimumAmount, "MarketDetail minimumAmount"),
  };
}

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
