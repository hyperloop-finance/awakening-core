"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { MarketDetail, Quote, QuoteSide } from "@/lib/api/types";
import { canSimulateSubmit, quoteSummary } from "@/lib/state/flows";
import { ErrorState, LoadingState } from "@/components/shell/states";
import { useRuntimeReadiness } from "@/components/shell/app-shell";
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
      <div className="eyebrow">
        {side === "BORROW" ? "BTC COLLATERAL PREVIEW" : "FIXED-PAYOUT OFFER PREVIEW"}
      </div>
      <h1 className="page-heading">{verb} against a fixed maturity.</h1>
      <p className="page-subtitle">
        {marketState.kind === "ready"
          ? `${marketState.market.collateralAsset} / ${marketState.market.principalAsset}`
          : "Market details pending"}
        {" · "}all calculations are off-chain previews. Live submission remains disabled.
      </p>

      {marketState.kind === "loading" && <LoadingState label="Loading market…" />}
      {marketState.kind === "error" && (
        <ErrorState message={marketState.message} retry={loadMarket} />
      )}

      {marketState.kind === "ready" && (
        <div className="flow-grid">
          <section className="glass-card flow-panel">
            <h2>{verb} quote</h2>
            <div className="preview-box market-detail-box">
              {borrowDetails(marketState.market).map(([label, value]) => (
                <div className="preview-row" key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <label className="form-label" htmlFor="amount">
              USDC amount
            </label>
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
            {amountError ? (
              <p className="field-help field-error">{amountError}</p>
            ) : (
              <p className="field-help">Quotes are indicative and expire after ten minutes.</p>
            )}
            <div className="action-stack">
              <button
                className="secondary-button"
                disabled={Boolean(amountError) || quoteState.kind === "loading"}
                onClick={refreshQuote}
              >
                {quoteState.kind === "loading" ? "Calculating…" : "Calculate quote"}
              </button>
            </div>
            {quote && (
              <div className="preview-box">
                {quoteSummary(quote).map(([label, value]) => (
                  <div className="preview-row" key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="glass-card flow-panel">
            <h2>Transaction preview</h2>
            <div className="warning-callout">
              {liveContractsReady
                ? "Runtime contracts are verified, but transaction integration is not implemented. Simulation is local only."
                : "Complete, non-zero deployment addresses are not available. Simulation is local only."}
            </div>
            {quoteState.kind === "error" && (
              <ErrorState message={quoteState.message} retry={refreshQuote} />
            )}
            {quote ? (
              <>
                <ul className="preview-steps">
                  {quote.executionSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <div className="action-stack">
                  <button className="primary-button" onClick={() => setPreviewed(true)}>
                    {previewed ? "Preview confirmed" : "Confirm preview"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!simulatedAllowed}
                    onClick={() => setSimulated(true)}
                  >
                    Simulate {side === "BORROW" ? "borrow" : "signing"}
                  </button>
                </div>
                {simulated && (
                  <p className="success-note">
                    Simulation recorded locally. No wallet request or on-chain transaction was sent.
                  </p>
                )}
              </>
            ) : quoteState.kind !== "error" ? (
              <p className="field-help">
                Calculate a quote to unlock the step-by-step preview.
              </p>
            ) : null}
            <button className="primary-button standalone-action" disabled>
              Live {verb.toLowerCase()}{" "}
              {liveContractsReady ? "not implemented" : "unavailable — addresses required"}
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
