import type { MarketSummary, PortfolioPayload, PortfolioPosition, Quote } from "../api/types";

export function filterMarkets(markets: MarketSummary[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return markets;
  return markets.filter((market) => `${market.id} ${market.label} ${market.collateralSymbol}`.toLowerCase().includes(normalized));
}

export function canSimulateSubmit({ amountError, previewed }: { amountError?: string; previewed: boolean }) {
  return !amountError && previewed;
}

const usdc = new Intl.NumberFormat("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });

export function quoteSummary(quote: Quote): [string, string][] {
  const common: [string, string][] = [
    ["Principal", `${usdc.format(Number(quote.principal))} USDC`],
    ["Fixed APR", `${quote.apr}%`],
    ["Maturity", new Date(quote.maturity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
  ];
  return quote.side === "BORROW"
    ? [["BTC collateral", `${quote.collateralRequired} BTC`], ...common, ["Interest", `${usdc.format(Number(quote.interest))} USDC`], ["Protocol fee", `${usdc.format(Number(quote.protocolFee))} USDC`], ["Total due at maturity", `${usdc.format(Number(quote.totalDue))} USDC`]]
    : [...common, ["Interest", `${usdc.format(Number(quote.interest))} USDC`], ["Protocol fee", `${usdc.format(Number(quote.protocolFee))} USDC`], ["Estimated payout", `${usdc.format(Number(quote.totalPayout))} USDC`]];
}

type PositionView = PortfolioPosition & { status: string };
export type PortfolioView =
  | { kind: "disconnected"; borrows: PositionView[]; lends: PositionView[] }
  | { kind: "empty"; borrows: PositionView[]; lends: PositionView[] }
  | { kind: "error"; message: string; borrows: PositionView[]; lends: PositionView[] }
  | { kind: "populated"; borrows: PositionView[]; lends: PositionView[]; summary: PortfolioPayload["summary"] };

function decoratePosition(position: PortfolioPosition): PositionView {
  const matured = position.settlementState === "MATURED" || new Date(position.maturity).getTime() <= Date.now();
  return { ...position, status: matured ? "Matured — settlement available" : "Active — fixed maturity" };
}

export function derivePortfolioView(payload?: PortfolioPayload | { error: string }): PortfolioView {
  if (!payload) return { kind: "disconnected", borrows: [], lends: [] };
  if ("error" in payload) return { kind: "error", message: payload.error, borrows: [], lends: [] };
  const positions = payload.positions.map(decoratePosition);
  const borrows = positions.filter((position) => position.side === "BORROW");
  const lends = positions.filter((position) => position.side === "LEND");
  if (!positions.length) return { kind: "empty", borrows, lends };
  return { kind: "populated", borrows, lends, summary: payload.summary };
}
