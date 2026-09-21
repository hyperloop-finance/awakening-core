import type { CreateOrderInput, MarketDetail, Order, OrderSide, PortfolioPayload, PositionPayload, Quote, QuoteSide, RuntimeConfig, SettlementAction, SettlementItem } from "./types";
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
    strike: "60000.00",
    patStatus: "VERIFIED_PREVIEW",
    patSource: "ATTESTED_CUSTODIAN_PREVIEW",
    borrowLevels: [{ apr: "0.0825", availableAmount: "75000.00" }, { apr: "0.0850", availableAmount: "100000.00" }],
    lendLevels: [{ apr: "0.0875", availableAmount: "80000.00" }, { apr: "0.0900", availableAmount: "95000.00" }],
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

let orders: Order[] = [];
let nextOrderId = 1;
export const getMockOrders = (wallet: string, side?: OrderSide) => orders.filter((order) => order.wallet === wallet && (!side || order.side === side));
export const createMockOrder = (input: CreateOrderInput): Order => {
  const order: Order = { ...input, id: `order-${nextOrderId++}`, filledAmount: "0", remainingAmount: input.amount, status: "OPEN", createdAt: new Date().toISOString() };
  orders = [order, ...orders]; return order;
};
export const cancelMockOrder = (id: string, wallet: string): Order => {
  const index = orders.findIndex((order) => order.id === id && order.wallet === wallet);
  if (index < 0) throw { detail: "Order not found", status: 404 };
  orders[index] = { ...orders[index], status: "CANCELLED" }; return orders[index];
};

export function getMockPositions(wallet: string): PositionPayload {
  const empty = { wallet, totals: { borrowedPrincipal: "0.00", lentPrincipal: "0.00", collateralLocked: "0.00000000", creditFaceValue: "0.00", debtOutstanding: "0.00" }, borrowPositions: [], lendPositions: [], profile: "mock", asOf: new Date().toISOString(), source: "MOCK_CATALOG" as const };
  if (wallet !== DEMO_WALLET) return empty;
  const common = { marketId: ids[0], fixedApr: "0.0850", strike: "60000.00", patStatus: "ATTRIBUTED_PREVIEW", patCoverage: "0.9500", maturity: "2026-12-31T00:00:00Z", settlementState: "OPEN" as const };
  return { ...empty, totals: { borrowedPrincipal: "1200.00", lentPrincipal: "800.00", collateralLocked: "0.03000000", creditFaceValue: "800.00", debtOutstanding: "1200.00" }, borrowPositions: [{ ...common, id: "borrow-demo-1", side: "BORROW", principal: "1200.00", collateral: "0.03000000", creditUnits: "0.00", debtUnits: "1200.00", faceValue: "0.00" }], lendPositions: [{ ...common, id: "lend-demo-1", side: "LEND", principal: "800.00", collateral: "0.00000000", creditUnits: "800.00", debtUnits: "0.00", faceValue: "800.00" }] };
}

const settlementProgress: Record<string, number> = {};
export function getMockSettlements(wallet: string): SettlementItem[] {
  const positions = getMockPositions(wallet); const now = Date.now();
  return [...positions.borrowPositions, ...positions.lendPositions].map((position) => {
    const matured = now >= Date.parse(position.maturity); const step = settlementProgress[position.id] ?? 0;
    let phase: SettlementItem["phase"] = "PRE_MATURITY"; let availableActions: SettlementAction[] = [];
    if (matured && position.side === "BORROW" && step === 0) { phase = "REPAYMENT_AVAILABLE"; availableActions = ["SIMULATE_REPAY_DEBT"]; }
    else if (matured && position.side === "BORROW" && step === 1) { phase = "READY_TO_CLAIM"; availableActions = ["SIMULATE_RECOVER_COLLATERAL"]; }
    else if (matured && position.side === "LEND" && step === 0) { phase = "READY_TO_CLAIM"; availableActions = ["SIMULATE_CLAIM_LENDER_PAYOUT"]; }
    else if (matured) phase = "FINALIZED";
    return { positionId: position.id, marketId: position.marketId, side: position.side, maturity: position.maturity, phase, outstandingDebt: position.side === "BORROW" && step === 0 ? position.debtUnits : "0", recoverableCollateral: position.side === "BORROW" && step < 2 ? position.collateral : "0", claimablePayout: position.side === "LEND" && step === 0 && matured ? position.faceValue : "0", claimableResidual: "0", patStatus: position.patStatus, availableActions, simulated: step > 0 };
  });
}
export const actMockSettlement = (positionId: string, wallet: string, action: SettlementAction) => {
  const current = getMockSettlements(wallet).find((item) => item.positionId === positionId);
  if (!current) throw { detail: "Position not found", status: 404 };
  if (!current.availableActions.includes(action)) throw { detail: "Action unavailable", status: 409 };
  settlementProgress[positionId] = (settlementProgress[positionId] ?? 0) + 1;
  return getMockSettlements(wallet).find((item) => item.positionId === positionId)!;
};
