"use client";

import { useState } from "react";
import { useRuntimeReadiness } from "@/components/shell/app-shell";
import { canPreviewOffer, offerSummary, validateOfferInput } from "./lend-flow";

export function LendScreen({ marketId }: { marketId: string; side?: "LEND" }) {
  const [amount, setAmount] = useState("1000");
  const [apr, setApr] = useState("12");
  const [previewed, setPreviewed] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const runtime = useRuntimeReadiness();
  const liveContractsReady = runtime.kind === "ready" && runtime.liveContractsReady;
  const error = validateOfferInput(amount, apr);

  const clearPreview = () => {
    setPreviewed(false);
    setSimulated(false);
  };

  return (
    <>
      <div className="eyebrow">OFF-CHAIN LEND OFFER</div>
      <h1 className="page-heading">Lend at a fixed APR.</h1>
      <div className="flow-grid">
        <section className="glass-card flow-panel">
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
              clearPreview();
            }}
          />
          <label className="form-label" htmlFor="lend-apr">
            APR
          </label>
          <input
            id="lend-apr"
            inputMode="decimal"
            className="amount-input"
            value={apr}
            onChange={(event) => {
              setApr(event.target.value);
              clearPreview();
            }}
          />
          {error && <p className="field-help field-error">{error}</p>}
          <button
            className="secondary-button standalone-action"
            disabled={Boolean(error)}
            onClick={() => setPreviewed(true)}
          >
            Preview offer
          </button>
        </section>
        <aside className="glass-card flow-panel">
          <h2>Offer & PAT summary</h2>
          {previewed &&
            offerSummary({ amount, apr, patCoverage: "100.00" }).map(([label, value]) => (
              <div className="preview-row" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          <div className="warning-callout">
            EIP191_MOCK only. Market {marketId.slice(0, 10)}… This page never requests a
            wallet signature or submits a chain transaction.
          </div>
          <div className="action-stack">
            <button
              className="primary-button"
              disabled={!canPreviewOffer({ error, previewed })}
              onClick={() => setSimulated(true)}
            >
              Simulate offer submission
            </button>
            <button className="primary-button" disabled>
              Live signature {liveContractsReady ? "not implemented" : "unavailable — addresses required"}
            </button>
          </div>
          {simulated && (
            <p className="success-note">
              Offer simulation recorded locally. No signature or transaction was sent.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
