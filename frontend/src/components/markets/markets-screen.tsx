"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { MarketDetail } from "@/lib/api/types";
import { formatDecimal } from "@/lib/format";
import { formatRateAsPercent } from "@/lib/fixed-decimal";
import { deriveMarketsOverview, filterMarkets } from "@/lib/state/flows";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";
import { CreditFlow } from "@/components/borrow/borrow-screen";
import type { QuoteSide } from "@/lib/api/types";

type MarketsState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; markets: MarketDetail[] };

export function MarketsScreen() {
  const [state, setState] = useState<MarketsState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [execution, setExecution] = useState<{ marketId: string; side: QuoteSide }>();
  const controllerRef = useRef<AbortController | undefined>(undefined);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ kind: "loading" });
    awakeningApi
      .markets(controller.signal)
      .then(async (markets) => {
        const details = await Promise.all(markets.map((market) => awakeningApi.market(market.id, controller.signal)));
        if (!controller.signal.aborted) setState({ kind: "ready", markets: details });
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
      <section className="markets-hero" aria-labelledby="markets-title">
        <div className="markets-hero-copy">
          <div className="hero-title-line">
            <h1 className="page-heading" id="markets-title">
              Borrow against BTC.<br />
              <span>Never get liquidated.</span>
            </h1>
            <div className="preview-status">
              <span aria-hidden="true" />
              DETERMINISTIC PREVIEW · NO LIVE TVL
            </div>
          </div>
          <p className="page-subtitle">
            Fixed-rate, fixed-maturity BTC credit. Every quote carries explicit put
            attribution, with no health checks or margin calls during the term.
          </p>
          <div className="invariant-panel" aria-label="Protocol repayment invariant">
            <span className="invariant-label">THE INVARIANT</span>
            <div className="invariant-equation">
              <span>min(S, K)</span>
              <i>+</i>
              <span>max(K − S, 0)</span>
              <i>=</i>
              <strong>K</strong>
            </div>
            <p>collateral value + put payoff = protected repayment at maturity</p>
          </div>
        </div>

        {overview && (
          <section className="market-overview" aria-label="Market overview">
            <div className="metric">
              <span>Total available</span>
              <strong>{formatDecimal(overview.totalLiquidity)} USDC</strong>
              <small>API catalog preview</small>
            </div>
            <div className="metric">
              <span>Market count</span>
              <strong>{overview.marketCount}</strong>
              <small>returned by current profile</small>
            </div>
            <div className="metric">
              <span>Average fixed APR</span>
              <strong>
                {overview.averageApr ? formatRateAsPercent(overview.averageApr) : "—"}
              </strong>
              <small>simple catalog average</small>
            </div>
            <div className="metric">
              <span>Next maturity</span>
              <strong>
                {overview.nextMaturity
                  ? `${overview.nextMaturity.slice(0, 10)} UTC`
                  : "—"}
              </strong>
              <small>fixed settlement date</small>
            </div>
          </section>
        )}
      </section>

      <section className="markets-section" aria-labelledby="market-catalog-title">
        <div className="section-heading">
          <div>
            <h2 id="market-catalog-title">Markets</h2>
            <p>Isolated BTC / USDC terms sourced from the current API profile.</p>
          </div>
          <div className="market-filter">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
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
          <div className="market-table">
            <table aria-label="Available markets">
              <thead>
                <tr>
                  <th scope="col">MARKET</th>
                  <th scope="col">FIXED APR</th>
                  <th scope="col">MATURITY</th>
                  <th scope="col">AVAILABLE</th>
                  <th scope="col">UTILIZATION</th>
                  <th scope="col">STRIKE / PAT</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((market) => (
                  <tr key={market.id}>
                    <th scope="row" className="market-name">
                      <span className="asset-pair">
                        <i className="asset-symbol asset-btc">B</i>
                        <i className="asset-symbol asset-usdc">$</i>
                        <b>{market.collateralAsset} / {market.principalAsset}</b>
                      </span>
                      <span className="market-meta">PAT terms resolved with quote</span>
                    </th>
                    <td data-label="Fixed APR"><span className="rate-badge">{formatRateAsPercent(market.fixedApr)}</span></td>
                    <td data-label="Maturity">{market.maturity.slice(0, 10)} UTC</td>
                    <td data-label="Available">{formatDecimal(market.availableLiquidity)} USDC</td>
                    <td data-label="Utilization">{formatRateAsPercent(market.utilization)}</td>
                    <td data-label="Strike / PAT"><strong>{formatDecimal(market.strike)} USDC</strong><small className="market-meta compact">{formatRateAsPercent(market.patCoverage)} · {market.patStatus.replace("_PREVIEW", "")}</small></td>
                    <td data-label="Status">
                      <span className={`status-badge status-${market.settlementState.toLowerCase()}`}>
                        <i aria-hidden="true" />{market.settlementState}
                      </span>
                    </td>
                    <td data-label="Actions" className="market-action-cell">
                      <span className="market-actions">
                        <button className="small-action" onClick={() => setExecution({ marketId: market.id, side: "BORROW" })}>
                          Borrow now
                        </button>
                        <button className="small-action" onClick={() => setExecution({ marketId: market.id, side: "LEND" })}>
                          Lend now
                        </button>
                        <a className="small-action secondary" href={`/orders?marketId=${market.id}&side=BORROW`}>
                          Place borrow order
                        </a>
                        <a className="small-action secondary" href={`/orders?marketId=${market.id}&side=LEND`}>
                          Place lend order
                        </a>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {execution && (
          <section className="inline-execution" aria-label={`${execution.side === "BORROW" ? "Borrow" : "Lend"} execution`}>
            <div className="inline-execution-head">
              <div><span>INLINE EXECUTION</span><h2>{execution.side === "BORROW" ? "Borrow" : "Lend"} without leaving the market</h2></div>
              <button className="inline-button" onClick={() => setExecution(undefined)}>Close</button>
            </div>
            <CreditFlow marketId={execution.marketId} side={execution.side} embedded />
          </section>
        )}
      </section>
    </>
  );
}
