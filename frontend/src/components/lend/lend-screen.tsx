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
  validateOfferApr,
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
  const [offerApr, setOfferApr] = useState("");
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
          setOfferApr(market.fixedApr);
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
  const offerAprError = validateOfferApr(offerApr);

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
          offerApr,
        })
      : undefined;

  return (
    <>
      <div className="eyebrow">OFF-CHAIN LEND OFFER</div>
      <h1 className="page-heading">Lend at a fixed APR.</h1>
      <p className="page-subtitle">
        {marketState.kind === "ready"
          ? `${marketState.market.collateralAsset} / ${marketState.market.principalAsset}`
          : "Market details pending"}
        {" · "}compare the market quote, then set the APR for your unsigned offer.
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
              <p className="field-help">
                Market quotes are indicative and expire after five minutes.
              </p>
            )}
            <label className="form-label" htmlFor="lend-apr">
              Offer APR
            </label>
            <input
              id="lend-apr"
              inputMode="decimal"
              className="amount-input"
              value={offerApr}
              onChange={(event) => {
                setOfferApr(event.target.value);
                setPreviewed(false);
                setSimulated(false);
              }}
            />
            {offerAprError ? (
              <p className="field-help field-error">{offerAprError}</p>
            ) : (
              <p className="field-help">
                Defaults to the market APR. Your rate only changes the unsigned offer.
              </p>
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
                <strong className="preview-label">Market indicative quote</strong>
                <p className="field-help">
                  Calculated by the API at the market&apos;s {quote.apr}% APR; it does not
                  estimate your custom offer.
                </p>
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
                    if (offerAprError) return;
                    setPreviewed(true);
                    setSimulated(false);
                  }}
                  disabled={Boolean(offerAprError)}
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
                  !canPreviewOffer({
                    hasQuote: Boolean(quote),
                    previewed,
                    offerAprError,
                  })
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
