import type { MarketSummary, PortfolioPayload, PortfolioPosition, Quote } from "../api/types";
import { formatDecimal } from "../format";
import { formatFixedDecimal, formatRateAsPercent, parseFixedDecimal } from "../fixed-decimal";

export function filterMarkets<T extends MarketSummary>(markets: T[], query: string): T[] {
  if (!query.trim()) return markets;
  const normalized = query.trim().toLowerCase();
  return markets.filter((market) =>
    `${market.id} ${market.collateralAsset} ${market.principalAsset} ${market.maturity}`
      .toLowerCase()
      .includes(normalized),
  );
}

export function deriveMarketsOverview(markets: MarketSummary[]) {
  const totalLiquidity = markets.reduce(
    (total, market) => total + parseFixedDecimal(market.availableLiquidity),
    BigInt(0),
  );
  const totalApr = markets.reduce(
    (total, market) => total + parseFixedDecimal(market.fixedApr),
    BigInt(0),
  );
  const nextMaturity = markets.reduce<string | undefined>(
    (next, market) => (!next || market.maturity < next ? market.maturity : next),
    undefined,
  );

  return {
    totalLiquidity: formatFixedDecimal(totalLiquidity),
    marketCount: markets.length,
    averageApr:
      markets.length > 0
        ? formatFixedDecimal(totalApr / BigInt(markets.length))
        : undefined,
    nextMaturity,
  };
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
    ["Fixed APR", formatRateAsPercent(quote.apr)],
    ["Interest", `${formatDecimal(quote.interest)} USDC`],
    ["Protocol fee", `${formatDecimal(quote.protocolFee)} USDC`],
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
