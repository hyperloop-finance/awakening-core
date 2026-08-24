"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRuntimeReadiness } from "@/components/shell/app-shell";
import { ErrorState, LoadingState } from "@/components/shell/states";
import { useWalletIdentity } from "@/components/shell/wallet";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import { validateDecimalInput } from "@/lib/api/quotes";
import type { MarketDetail, Quote } from "@/lib/api/types";
import { quoteSummary } from "@/lib/state/flows";
import {
  buildUnsignedOfferPayload,
  canPreviewOffer,
  lendDetails,
} from "./lend-flow";

type MarketState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; market: MarketDetail };

type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; quote: Quote };

export function LendScreen({ marketId }: { marketId: string; side?: "LEND" }) {
  const [marketState, setMarketState] = useState<MarketState>({ kind: "loading" });
  const [quoteState, setQuoteState] = useState<QuoteState>({ kind: "idle" });
  const [amount, setAmount] = useState("1000");
  const [previewed, setPreviewed] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const marketController = useRef<AbortController | undefined>(undefined);
  const marketGeneration = useRef(0);
  const quoteController = useRef<AbortController | undefined>(undefined);
  const quoteGeneration = useRef(0);
  const runtime = useRuntimeReadiness();
  const { wallet } = useWalletIdentity();

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
  }, [clearQuote, loadMarket]);

  useEffect(() => () => quoteController.current?.abort(), []);

  const minimum = marketState.kind === "ready" ? marketState.market.minimumAmount : "0";
  const amountError = validateDecimalInput(amount, minimum);

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
      .quote(marketId, "LEND", amount, controller.signal)
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
  }, [amount, amountError, marketId, marketState]);

  const quote = quoteState.kind === "ready" ? quoteState.quote : undefined;
  const liveContractsReady = runtime.kind === "ready" && runtime.liveContractsReady;
  const payload =
    quote && previewed
      ? buildUnsignedOfferPayload({
          quote,
          marketId,
          chainId: runtime.kind === "ready" ? runtime.config.chainId : undefined,
          wallet,
        })
      : undefined;

  return (
    <>
      <div className="eyebrow">OFF-CHAIN LEND OFFER</div>
      <h1 className="page-heading">Lend at the market&apos;s fixed APR.</h1>
      <p className="page-subtitle">
        {marketState.kind === "ready"
          ? `${marketState.market.collateralAsset} / ${marketState.market.principalAsset}`
          : "Market details pending"}
        {" · "}the API calculates the payout. This interface never signs or submits an
        offer.
      </p>

      {marketState.kind === "loading" && <LoadingState label="Loading market…" />}
      {marketState.kind === "error" && (
        <ErrorState message={marketState.message} retry={loadMarket} />
      )}

      {marketState.kind === "ready" && (
        <div className="flow-grid">
          <section className="glass-card flow-panel">
            <h2>Lend quote</h2>
            <div className="preview-box market-detail-box">
              {lendDetails(marketState.market).map(([label, value]) => (
                <div className="preview-row" key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <label className="form-label" htmlFor="lend-amount">
              USDC amount
            </label>
            <input
              id="lend-amount"
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
            <button
              className="secondary-button standalone-action"
              disabled={Boolean(amountError) || quoteState.kind === "loading"}
              onClick={refreshQuote}
            >
              {quoteState.kind === "loading" ? "Calculating…" : "Calculate lend quote"}
            </button>
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
            <h2>Unsigned offer preview</h2>
            <div className="warning-callout">
              {liveContractsReady
                ? "Contracts are configured, but signing and offer submission are not implemented. Simulation remains local."
                : "No private key or complete deployment is available. Simulation remains local."}
            </div>
            {quoteState.kind === "error" && (
              <ErrorState message={quoteState.message} retry={refreshQuote} />
            )}
            {quote ? (
              <>
                <button
                  className="primary-button standalone-action"
                  onClick={() => {
                    setPreviewed(true);
                    setSimulated(false);
                  }}
                >
                  {previewed ? "Offer preview ready" : "Preview offer"}
                </button>
                {payload && (
                  <div className="preview-box offer-preview">
                    <div className="preview-row">
                      <span>Signing scheme</span>
                      <b>EIP191_MOCK</b>
                    </div>
                    <pre className="offer-payload" aria-label="Unsigned offer payload">
                      {payload}
                    </pre>
                    <p className="field-help">
                      This is an unsigned payload preview. No wallet signature was requested.
                    </p>
                  </div>
                )}
              </>
            ) : quoteState.kind !== "error" ? (
              <p className="field-help">Calculate a quote to preview the offer payload.</p>
            ) : null}
            <div className="action-stack">
              <button
                className="primary-button"
                disabled={
                  !canPreviewOffer({ hasQuote: Boolean(quote), previewed })
                }
                onClick={() => setSimulated(true)}
              >
                Simulate offer submission
              </button>
              <button className="primary-button" disabled>
                Live signature{" "}
                {liveContractsReady
                  ? "not implemented"
                  : "unavailable — addresses required"}
              </button>
            </div>
            {simulated && (
              <p className="success-note">
                Offer simulation recorded locally. No signature or transaction was sent.
              </p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
