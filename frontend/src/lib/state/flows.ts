import type { MarketSummary, PortfolioPayload, PortfolioPosition, Quote } from "../api/types";
import { formatDecimal } from "../format";

export function filterMarkets(markets: MarketSummary[], query: string) {
  if (!query.trim()) return markets;
  const normalized = query.trim().toLowerCase();
  return markets.filter((market) =>
    `${market.id} ${market.collateralAsset} ${market.principalAsset} ${market.maturity}`
      .toLowerCase()
      .includes(normalized),
  );
}

export function canSimulateSubmit({
  amountError,
  previewed,
}: {
  amountError?: string;
  previewed: boolean;
}) {
  return !amountError && previewed;
}

export function quoteSummary(quote: Quote): [string, string][] {
  return [
    ["Principal", `${formatDecimal(quote.principal)} USDC`],
    ["BTC collateral", `${formatDecimal(quote.collateralRequirement, 8)} BTC`],
    ["Fixed APR", `${quote.apr}%`],
    [
      quote.side === "BORROW" ? "Total due at maturity" : "Total payout",
      `${formatDecimal(quote.totalDueOrPayout)} USDC`,
    ],
    ["Maturity", `${quote.maturity.slice(0, 10)} UTC`],
  ];
}

type PositionView = PortfolioPosition & { status: string };
export type PortfolioView = {
  kind: "disconnected" | "empty" | "error" | "populated";
  borrows: PositionView[];
  lends: PositionView[];
  summary?: PortfolioPayload["totals"];
  message?: string;
};

export function derivePortfolioView(
  payload?: PortfolioPayload | { error: string },
): PortfolioView {
  if (!payload) return { kind: "disconnected", borrows: [], lends: [] };
  if ("error" in payload) {
    return { kind: "error", message: payload.error, borrows: [], lends: [] };
  }
  const decorate = (position: PortfolioPosition): PositionView => ({
    ...position,
    status:
      position.settlementState === "MATURED"
        ? "Matured — settlement available"
        : position.settlementState === "SETTLED"
          ? "Settled"
          : "Active — fixed maturity",
  });
  const borrows = payload.borrowPositions.map(decorate);
  const lends = payload.lendPositions.map(decorate);
  return borrows.length || lends.length
    ? { kind: "populated", borrows, lends, summary: payload.totals }
    : { kind: "empty", borrows, lends };
}
