"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { PortfolioPayload } from "@/lib/api/types";
import { formatDecimal, formatUtcDate } from "@/lib/format";
import { derivePortfolioView } from "@/lib/state/flows";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";
import { useWalletIdentity } from "@/components/shell/wallet";

type PortfolioState =
  | { kind: "disconnected" }
  | { kind: "loading"; wallet: string }
  | { kind: "error"; wallet: string; message: string }
  | { kind: "ready"; wallet: string; payload: PortfolioPayload };

function PositionList({
  title,
  positions,
}: {
  title: string;
  positions: ReturnType<typeof derivePortfolioView>["borrows"];
}) {
  const label = title === "Borrows" ? "Borrow positions" : "Lend positions";
  return (
    <section className="position-section">
      <div className="position-section-head">
        <h2>{title}</h2>
        <span>{positions.length} POSITION{positions.length === 1 ? "" : "S"}</span>
      </div>
      <div className="position-table-wrap">
        <table className="position-table" aria-label={label}>
          <thead>
            <tr>
              <th scope="col">MARKET / POSITION</th>
              <th scope="col">PRINCIPAL</th>
              <th scope="col">COLLATERAL</th>
              <th scope="col">MATURITY</th>
              <th scope="col">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr><td className="empty-table-cell" colSpan={5}>No {title.toLowerCase()} in this wallet preview.</td></tr>
            ) : positions.map((position) => (
              <tr key={position.id}>
                <th scope="row">
                  <span className="position-market">BTC / USDC</span>
                  <span className="position-id" title={position.marketId}>{position.marketId}</span>
                </th>
                <td>{formatDecimal(position.principal)} USDC</td>
                <td>{formatDecimal(position.collateral, 8)} BTC</td>
                <td>Matures {formatUtcDate(position.maturity)} UTC</td>
                <td>
                  <span className={position.status.startsWith("Matured") ? "status-badge status-matured" : "status-badge status-open"}>
                    <i aria-hidden="true" />{position.status}
                  </span>
                  {position.settlementState === "MATURED" && (
                    <small>Review only · transaction disabled</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PortfolioScreen() {
  const { wallet, setDemoEnabled } = useWalletIdentity();
  const [state, setState] = useState<PortfolioState>({ kind: "disconnected" });
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const generationRef = useRef(0);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const generation = ++generationRef.current;
    if (!wallet) {
      setState({ kind: "disconnected" });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestedWallet = wallet;
    setState({ kind: "loading", wallet: requestedWallet });
    awakeningApi
      .portfolio(requestedWallet, controller.signal)
      .then((payload) => {
        if (generation === generationRef.current && !controller.signal.aborted) {
          setState({ kind: "ready", wallet: requestedWallet, payload });
        }
      })
      .catch((reason) => {
        if (generation === generationRef.current && !controller.signal.aborted) {
          setState({
            kind: "error",
            wallet: requestedWallet,
            message: normalizeApiError(reason).message,
          });
        }
      });
  }, [wallet]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const currentState: PortfolioState = !wallet
    ? { kind: "disconnected" }
    : "wallet" in state && state.wallet === wallet
      ? state
      : { kind: "loading", wallet };

  let content;
  if (currentState.kind === "disconnected") {
    content = (
      <EmptyState title="Connect a wallet to view positions">
        <button className="inline-button" onClick={() => setDemoEnabled(true)}>
          Use demo wallet
        </button>
      </EmptyState>
    );
  } else if (currentState.kind === "loading") {
    content = <LoadingState label="Loading portfolio…" />;
  } else if (currentState.kind === "error") {
    content = <ErrorState message={currentState.message} retry={load} />;
  } else {
    const view = derivePortfolioView(currentState.payload);
    if (view.kind === "empty") {
      content = (
        <EmptyState title="No active positions">
          <Link className="inline-button" href="/markets">
            Browse markets
          </Link>
        </EmptyState>
      );
    } else {
      content = (
        <>
          <section className="portfolio-summary" aria-label="Portfolio overview">
            <div className="summary-lead">
              <span>{currentState.payload.meta.profile.toUpperCase()} WALLET OVERVIEW</span>
              <strong>Fixed-maturity positions</strong>
              <small>Values returned by the current portfolio API profile.</small>
            </div>
            <div className="metric">
              <span>BORROWED</span>
              <strong>{formatDecimal(view.summary?.borrowedPrincipal ?? "0")} USDC</strong>
            </div>
            <div className="metric">
              <span>LENT</span>
              <strong>{formatDecimal(view.summary?.lentPrincipal ?? "0")} USDC</strong>
            </div>
            <div className="metric">
              <span>BTC LOCKED</span>
              <strong>{formatDecimal(view.summary?.collateralLocked ?? "0", 8)}</strong>
            </div>
          </section>
          <div className="positions-ledger">
            <PositionList title="Borrows" positions={view.borrows} />
            <PositionList title="Lends" positions={view.lends} />
          </div>
        </>
      );
    }
  }

  return (
    <>
      <header className="portfolio-hero">
        <span className="preview-status"><span aria-hidden="true" />POSITION CONTROL CENTER · PREVIEW</span>
        <h1 className="page-heading">Portfolio</h1>
        <p className="page-subtitle">Inspect borrow and lend exposure by fixed maturity. Settlement actions remain review-only.</p>
      </header>
      {content}
    </>
  );
}
