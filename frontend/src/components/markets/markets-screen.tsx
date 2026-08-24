"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { MarketSummary } from "@/lib/api/types";
import { formatDecimal } from "@/lib/format";
import { deriveMarketsOverview, filterMarkets } from "@/lib/state/flows";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";

type MarketsState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; markets: MarketSummary[] };

export function MarketsScreen() {
  const [state, setState] = useState<MarketsState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const controllerRef = useRef<AbortController | undefined>(undefined);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ kind: "loading" });
    awakeningApi
      .markets(controller.signal)
      .then((markets) => {
        if (!controller.signal.aborted) setState({ kind: "ready", markets });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setState({ kind: "error", message: normalizeApiError(reason).message });
        }
      });
  }, []);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const filtered = state.kind === "ready" ? filterMarkets(state.markets, query) : [];
  const overview =
    state.kind === "ready" ? deriveMarketsOverview(state.markets) : undefined;

  return (
    <>
      <div className="eyebrow">FIXED RATE · FIXED MATURITY · BTC COLLATERAL</div>
      <h1 className="page-heading">BTC credit without interim liquidations.</h1>
      <p className="page-subtitle">
        Explore BTC / USDC markets. Positions remain previews until contract addresses are
        configured.
      </p>
      {overview && (
        <section className="overview-grid" aria-label="Market overview">
          <div className="glass-card metric">
            <span>Total available</span>
            <strong>{formatDecimal(overview.totalLiquidity)} USDC</strong>
          </div>
          <div className="glass-card metric">
            <span>Market count</span>
            <strong>{overview.marketCount}</strong>
          </div>
          <div className="glass-card metric">
            <span>Average fixed APR</span>
            <strong>{overview.averageApr ? `${overview.averageApr}%` : "—"}</strong>
          </div>
          <div className="glass-card metric">
            <span>Next maturity</span>
            <strong>
              {overview.nextMaturity
                ? `${overview.nextMaturity.slice(0, 10)} UTC`
                : "—"}
            </strong>
          </div>
        </section>
      )}
      <section>
        <div className="section-heading">
          <div>
            <h2>Markets</h2>
            <p>Filter by market identifier or maturity.</p>
          </div>
          <div className="market-filter">
            <input
              className="filter-input"
              aria-label="Filter markets"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search markets…"
            />
          </div>
        </div>

        {state.kind === "loading" && <LoadingState />}
        {state.kind === "error" && <ErrorState message={state.message} retry={load} />}
        {state.kind === "ready" && state.markets.length === 0 && (
          <EmptyState title="No markets available">
            The API returned an empty market catalog.
          </EmptyState>
        )}
        {state.kind === "ready" && state.markets.length > 0 && filtered.length === 0 && (
          <EmptyState title="No BTC markets match this filter">
            <button className="inline-button" onClick={() => setQuery("")}>
              Clear search
            </button>
          </EmptyState>
        )}
        {filtered.length > 0 && (
          <div className="glass-card market-table">
            <table aria-label="Available markets">
              <thead>
                <tr>
                  <th scope="col">MARKET</th>
                  <th scope="col">APR</th>
                  <th scope="col">MATURITY</th>
                  <th scope="col">AVAILABLE</th>
                  <th scope="col">UTILIZATION</th>
                  <th scope="col">OFFERS</th>
                  <th scope="col">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((market) => (
                  <tr key={market.id}>
                    <th scope="row" className="market-name">
                      {market.collateralAsset} / {market.principalAsset}
                      <span className="market-meta">PAT coverage preview</span>
                    </th>
                    <td>{market.fixedApr}%</td>
                    <td>{market.maturity.slice(0, 10)} UTC</td>
                    <td>{formatDecimal(market.availableLiquidity)} USDC</td>
                    <td>{market.utilization}%</td>
                    <td>{market.offerDepth}</td>
                    <td>
                      <span className="market-actions">
                        <Link className="small-action" href={`/borrow/${market.id}`}>
                          Borrow
                        </Link>
                        <Link className="small-action" href={`/lend/${market.id}`}>
                          Lend
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
