"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRuntimeReadiness } from "@/components/shell/app-shell";
import { ErrorState, LoadingState } from "@/components/shell/states";
import { useWalletIdentity } from "@/components/shell/wallet";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import { validateDecimalInput } from "@/lib/api/quotes";
import type { MarketDetail, Quote } from "@/lib/api/types";
import { decimalRateToPercent, formatRateAsPercent } from "@/lib/fixed-decimal";
import { formatDecimal } from "@/lib/format";
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
  const [offerAprPercent, setOfferAprPercent] = useState("");
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
          setOfferAprPercent(decimalRateToPercent(market.fixedApr));
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
  const offerAprError = validateOfferApr(offerAprPercent);

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
          offerAprPercent,
        })
      : undefined;

  return (
    <>
      <header className="flow-hero">
        <Link className="back-link" href="/markets">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="m15 5-7 7 7 7" /></svg>
          Markets
        </Link>
        <div className="flow-title-row">
          <div>
            <h1 className="page-heading">Lend at a fixed APR.</h1>
            <p className="page-subtitle">
              {marketState.kind === "ready"
                ? `${marketState.market.collateralAsset} / ${marketState.market.principalAsset}`
                : "Market details pending"}
              {" · "}compare the market quote, then define your offer rate.
            </p>
          </div>
          <div className="flow-statuses">
            <span className="preview-status"><span aria-hidden="true" />UNSIGNED OFFER PREVIEW</span>
            <span className="non-live-badge">NO SIGNATURE REQUEST</span>
          </div>
        </div>
      </header>

      {marketState.kind === "loading" && <LoadingState label="Loading market…" />}
      {marketState.kind === "error" && (
        <ErrorState message={marketState.message} retry={loadMarket} />
      )}

      {marketState.kind === "ready" && (
        <div className="flow-grid">
          <div className="market-context">
            <section className="market-facts" aria-labelledby="lend-market-facts-title">
              <div className="panel-heading">
                <div>
                  <h2 id="lend-market-facts-title">Market facts <small>{marketState.market.collateralAsset} / {marketState.market.principalAsset}</small></h2>
                </div>
                <span className={`status-badge status-${marketState.market.settlementState.toLowerCase()}`}>
                  <i aria-hidden="true" />{marketState.market.settlementState}
                </span>
              </div>
              <div className="market-id" title={marketState.market.id}>{marketState.market.id}</div>
              <dl className="fact-list">
                <div><dt>Maturity</dt><dd>{marketState.market.maturity.slice(0, 10)} UTC</dd></div>
                <div><dt>Available liquidity</dt><dd>{formatDecimal(marketState.market.availableLiquidity)} {marketState.market.principalAsset}</dd></div>
                {lendDetails(marketState.market).map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            </section>

            <section className="pat-explainer" aria-labelledby="lend-pat-title">
              <div className="pat-seal" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="15" /><path d="M13 23c4-8 10-8 14 0M20 11v18" /></svg>
              </div>
              <div>
                <div className="pat-title-line">
                  <h2 id="lend-pat-title">Put-attributed lender protection</h2>
                  <span className="pat-label">PAT</span>
                </div>
                <p>
                  Each credit unit is paired with downside attribution at the market strike.
                  The terminal repayment design is reviewed at quote time and settles at maturity.
                </p>
              </div>
              <div className="pat-equation"><span>COLLATERAL</span><i>+</i><span>PUT PAYOFF</span><i>=</i><strong>K</strong></div>
            </section>

            <section className="term-track" aria-label="Lend lifecycle">
              <div className="term-step term-step-active"><span>NOW</span><strong>Draft offer</strong></div>
              <div className="term-step"><span>FILL</span><strong>PAT checked</strong></div>
              <div className="term-step"><span>MATURITY</span><strong>Fixed payout</strong></div>
            </section>
          </div>

          <section className="transaction-ticket" aria-labelledby="lend-ticket-title">
            <div className="ticket-heading">
              <h2 id="lend-ticket-title">Offer ticket</h2>
              <span className="ticket-mode">MOCK · LEND / {marketState.market.principalAsset}</span>
            </div>
            <div className="warning-callout">
              {liveContractsReady
                ? "Contracts are configured, but signing and offer submission are not implemented. Simulation remains local."
                : "No private key or complete deployment is available. Simulation remains local."}
            </div>
            <label className="form-label" htmlFor="lend-amount">
              {marketState.market.principalAsset} amount
            </label>
            <div className="amount-field">
              <input id="lend-amount" inputMode="decimal" className="amount-input" value={amount}
                onChange={(event) => { setAmount(event.target.value); clearQuote(); }} />
              <span>{marketState.market.principalAsset}</span>
            </div>
            {amountError ? (
              <p className="field-help field-error">{amountError}</p>
            ) : (
              <p className="field-help">
                Market quotes are indicative and expire after five minutes.
              </p>
            )}
            <label className="form-label" htmlFor="lend-apr">
              Offer APR (%)
            </label>
            <div className="amount-field">
              <input id="lend-apr" inputMode="decimal" className="amount-input" value={offerAprPercent}
                onChange={(event) => { setOfferAprPercent(event.target.value); setPreviewed(false); setSimulated(false); }} />
              <span>% APR</span>
            </div>
            {offerAprError ? (
              <p className="field-help field-error">{offerAprError}</p>
            ) : (
              <p className="field-help">
                Enter a percentage: 8.5 means 8.5%. The payload uses decimal rate 0.085.
              </p>
            )}
            <button
              className="secondary-button standalone-action"
              disabled={Boolean(amountError) || quoteState.kind === "loading"}
              onClick={refreshQuote}
            >
              {quoteState.kind === "loading" ? "Calculating…" : "Calculate lend quote"}
            </button>
            {quoteState.kind === "error" && <ErrorState message={quoteState.message} retry={refreshQuote} />}
            {quote && (
              <div className="quote-result">
                <div className="quote-result-head"><span>MARKET INDICATIVE QUOTE</span><time>{quote.expiresAt.slice(11, 16)} UTC expiry</time></div>
                <div className="preview-box">
                <strong className="preview-label">Market indicative quote</strong>
                <p className="field-help">
                  Calculated by the API at the market&apos;s {formatRateAsPercent(quote.apr)}
                  APR; it does not estimate your custom offer.
                </p>
                {quoteSummary(quote, marketState.market).map(([label, value]) => (
                  <div className="preview-row" key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
                </div>
                <div className="step-preview">
                  <h3>Offer preview steps</h3>
                  <ol className="preview-steps">
                    {quote.executionSteps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
                <button
                  className="primary-button standalone-action"
                  onClick={() => { if (offerAprError) return; setPreviewed(true); setSimulated(false); }}
                  disabled={Boolean(offerAprError)}
                >
                  {previewed ? "Offer preview ready" : "Preview offer"}
                </button>
                {payload && (
                  <div className="preview-box offer-preview">
                    <div className="preview-row"><span>Signing scheme</span><b>EIP191_MOCK</b></div>
                    <pre className="offer-payload" aria-label="Unsigned offer payload">{payload}</pre>
                    <p className="field-help">This is an unsigned payload preview. No wallet signature was requested.</p>
                  </div>
                )}
              </div>
            )}
            {!quote && quoteState.kind !== "error" && (
              <div className="ticket-placeholder"><span>OFFER PREVIEW PENDING</span><p>Calculate a quote to inspect payout, PAT-backed terms, and the unsigned payload.</p></div>
            )}
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
          </section>
        </div>
      )}
    </>
  );
}
