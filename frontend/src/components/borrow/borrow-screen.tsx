"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { MarketDetail, Quote, QuoteSide } from "@/lib/api/types";
import { canSimulateSubmit, quoteSummary } from "@/lib/state/flows";
import { ErrorState, LoadingState } from "@/components/shell/states";
import { useRuntimeReadiness } from "@/components/shell/app-shell";
import { formatRateAsPercent } from "@/lib/fixed-decimal";
import { borrowDetails, validateBorrowAmount } from "./quote-lifecycle";

type MarketState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; market: MarketDetail };

type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; quote: Quote };

export function CreditFlow({ marketId, side }: { marketId: string; side: QuoteSide }) {
  const [marketState, setMarketState] = useState<MarketState>({ kind: "loading" });
  const [quoteState, setQuoteState] = useState<QuoteState>({ kind: "idle" });
  const [amount, setAmount] = useState(side === "BORROW" ? "1000" : "5000");
  const [previewed, setPreviewed] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const marketController = useRef<AbortController | undefined>(undefined);
  const marketGeneration = useRef(0);
  const quoteController = useRef<AbortController | undefined>(undefined);
  const quoteGeneration = useRef(0);
  const runtime = useRuntimeReadiness();

  const clearQuote = useCallback(() => {
    quoteController.current?.abort();
    quoteGeneration.current += 1;
    setQuoteState({ kind: "idle" });
    setPreviewed(false);
    setSimulated(false);
  }, []);

  const loadMarket = useCallback(() => {
    marketController.current?.abort();
    const generation = ++marketGeneration.current;
    const controller = new AbortController();
    marketController.current = controller;
    setMarketState({ kind: "loading" });
    awakeningApi
      .market(marketId, controller.signal)
      .then((market) => {
        if (generation === marketGeneration.current && !controller.signal.aborted) {
          setMarketState({ kind: "ready", market });
        }
      })
      .catch((reason) => {
        if (generation === marketGeneration.current && !controller.signal.aborted) {
          setMarketState({ kind: "error", message: normalizeApiError(reason).message });
        }
      });
  }, [marketId]);

  useEffect(() => {
    clearQuote();
    loadMarket();
    return () => marketController.current?.abort();
  }, [clearQuote, loadMarket, side]);

  useEffect(() => () => quoteController.current?.abort(), []);

  const minimum = marketState.kind === "ready" ? marketState.market.minimumAmount : "0";
  const amountError = validateBorrowAmount(amount, minimum);

  const refreshQuote = useCallback(() => {
    if (marketState.kind !== "ready" || amountError) return;
    quoteController.current?.abort();
    const generation = ++quoteGeneration.current;
    const controller = new AbortController();
    quoteController.current = controller;
    setQuoteState({ kind: "loading" });
    setPreviewed(false);
    setSimulated(false);
    awakeningApi
      .quote(marketId, side, amount, controller.signal)
      .then((quote) => {
        if (generation === quoteGeneration.current && !controller.signal.aborted) {
          setQuoteState({ kind: "ready", quote });
        }
      })
      .catch((reason) => {
        if (generation === quoteGeneration.current && !controller.signal.aborted) {
          setQuoteState({ kind: "error", message: normalizeApiError(reason).message });
        }
      });
  }, [amount, amountError, marketId, marketState, side]);

  const verb = side === "BORROW" ? "Borrow" : "Lend";
  const quote = quoteState.kind === "ready" ? quoteState.quote : undefined;
  const simulatedAllowed = canSimulateSubmit({ amountError, previewed });
  const liveContractsReady = runtime.kind === "ready" && runtime.liveContractsReady;

  return (
    <>
      <header className="flow-hero">
        <Link className="back-link" href="/markets">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="m15 5-7 7 7 7" /></svg>
          Markets
        </Link>
        <div className="flow-title-row">
          <div>
            <span className="preview-status"><span aria-hidden="true" />LOCAL TRANSACTION PREVIEW</span>
            <h1 className="page-heading">{verb} against a fixed maturity.</h1>
            <p className="page-subtitle">
              {marketState.kind === "ready"
                ? `${marketState.market.collateralAsset} / ${marketState.market.principalAsset}`
                : "Market details pending"}
              {" · "}review every consequence before a local simulation.
            </p>
          </div>
          <span className="non-live-badge">NO WALLET REQUEST</span>
        </div>
      </header>

      {marketState.kind === "loading" && <LoadingState label="Loading market…" />}
      {marketState.kind === "error" && (
        <ErrorState message={marketState.message} retry={loadMarket} />
      )}

      {marketState.kind === "ready" && (
        <div className="flow-grid">
          <div className="market-context">
            <section className="market-facts" aria-labelledby="market-facts-title">
              <div className="panel-heading">
                <div>
                  <span>MARKET FACTS</span>
                  <h2 id="market-facts-title">
                    {marketState.market.collateralAsset} / {marketState.market.principalAsset}
                  </h2>
                </div>
                <span className={`status-badge status-${marketState.market.settlementState.toLowerCase()}`}>
                  <i aria-hidden="true" />{marketState.market.settlementState}
                </span>
              </div>
              <div className="market-id" title={marketState.market.id}>{marketState.market.id}</div>
              <dl className="fact-list">
                <div><dt>Fixed APR</dt><dd>Market · {formatRateAsPercent(marketState.market.fixedApr)}</dd></div>
                <div><dt>Maturity</dt><dd>{marketState.market.maturity.slice(0, 10)} UTC</dd></div>
                {borrowDetails(marketState.market).map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </section>

            <section className="pat-explainer" aria-labelledby="pat-explainer-title">
              <div className="pat-seal" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="15" /><path d="M13 23c4-8 10-8 14 0M20 11v18" /></svg>
              </div>
              <div>
                <span className="pat-label">PUT ATTRIBUTION TOKEN</span>
                <h2 id="pat-explainer-title">Why PAT removes interim liquidation</h2>
                <p>
                  Collateral covers value up to strike K; the attributed put covers the
                  shortfall below K. Settlement happens at maturity, not during price moves.
                </p>
              </div>
              <div className="pat-equation">
                <span>min(S, K)</span><i>+</i><span>max(K − S, 0)</span><i>=</i><strong>K</strong>
              </div>
            </section>

            <section className="term-track" aria-label="Borrow lifecycle">
              <div className="term-step term-step-active"><span>NOW</span><strong>Quote &amp; preview</strong></div>
              <div className="term-step"><span>TERM</span><strong>No health checks</strong></div>
              <div className="term-step"><span>MATURITY</span><strong>Repay or settle</strong></div>
            </section>
          </div>

          <section className="transaction-ticket" aria-labelledby="transaction-ticket-title">
            <div className="ticket-heading">
              <div><span>{side} / USDC</span><h2 id="transaction-ticket-title">Transaction ticket</h2></div>
              <span className="ticket-mode">MOCK</span>
            </div>
            <div className="warning-callout">
              {liveContractsReady
                ? "Runtime contracts are verified, but transaction integration is not implemented. Simulation is local only."
                : "Complete, non-zero deployment addresses are not available. Simulation is local only."}
            </div>
            <label className="form-label" htmlFor="amount">
              USDC amount
            </label>
            <div className="amount-field">
              <input
                id="amount"
                inputMode="decimal"
                className="amount-input"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  clearQuote();
                }}
              />
              <span>USDC</span>
            </div>
            {amountError ? (
              <p className="field-help field-error">{amountError}</p>
            ) : (
              <p className="field-help">Indicative quotes expire after five minutes · minimum {marketState.market.minimumAmount} USDC.</p>
            )}
            <button
              className="secondary-button standalone-action"
              disabled={Boolean(amountError) || quoteState.kind === "loading"}
              onClick={refreshQuote}
            >
              {quoteState.kind === "loading" ? "Calculating…" : "Calculate quote"}
            </button>

            {quoteState.kind === "error" && (
              <ErrorState message={quoteState.message} retry={refreshQuote} />
            )}
            {quote ? (
              <div className="quote-result">
                <div className="quote-result-head"><span>INDICATIVE QUOTE</span><time>{quote.expiresAt.slice(11, 16)} UTC expiry</time></div>
                <div className="preview-box">
                  {quoteSummary(quote).map(([label, value]) => (
                    <div className="preview-row" key={label}>
                      <span>{label}</span><b>{value}</b>
                    </div>
                  ))}
                </div>
                <div className="step-preview">
                  <h3>Execution preview</h3>
                  <ol className="preview-steps">
                    {quote.executionSteps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
                <div className="action-stack">
                  <button className="primary-button" onClick={() => setPreviewed(true)}>
                    {previewed ? "Preview confirmed" : "Confirm preview"}
                  </button>
                  <button className="secondary-button" disabled={!simulatedAllowed} onClick={() => setSimulated(true)}>
                    Simulate {side === "BORROW" ? "borrow" : "signing"}
                  </button>
                </div>
                {simulated && <p className="success-note">Simulation recorded locally. No wallet request or on-chain transaction was sent.</p>}
              </div>
            ) : quoteState.kind !== "error" ? (
              <div className="ticket-placeholder"><span>QUOTE PENDING</span><p>Enter an amount to reveal exact principal, collateral, interest, fee, and maturity steps.</p></div>
            ) : null}
            <button className="primary-button live-action" disabled>
              Live {verb.toLowerCase()} {liveContractsReady ? "not implemented" : "unavailable — addresses required"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
