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
  return (
    <section className="glass-card">
      <div className="flow-panel">
        <h2>{title}</h2>
        <p className="field-help">Fixed maturity positions</p>
      </div>
      <div className="position-list">
        {positions.map((position) => (
          <article className="position-row" key={position.id}>
            <div className="position-top">
              <strong>{position.marketId}</strong>
              <span
                className={
                  position.status.startsWith("Matured")
                    ? "status status-matured"
                    : "status"
                }
              >
                {position.status}
              </span>
            </div>
            <div className="position-meta">
              <span>{formatDecimal(position.principal)} USDC</span>
              <span>Matures {formatUtcDate(position.maturity)} UTC</span>
            </div>
            {position.settlementState === "MATURED" && (
              <p className="field-help">
                Settlement is displayed for review only; no transaction action is enabled.
              </p>
            )}
          </article>
        ))}
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
          <section className="overview-grid">
            <div className="glass-card metric">
              <span>BORROWED</span>
              <strong>{formatDecimal(view.summary?.borrowedPrincipal ?? "0")} USDC</strong>
            </div>
            <div className="glass-card metric">
              <span>LENT</span>
              <strong>{formatDecimal(view.summary?.lentPrincipal ?? "0")} USDC</strong>
            </div>
            <div className="glass-card metric">
              <span>BTC LOCKED</span>
              <strong>{formatDecimal(view.summary?.collateralLocked ?? "0", 8)}</strong>
            </div>
          </section>
          <div className="positions-grid">
            <PositionList title="Borrows" positions={view.borrows} />
            <PositionList title="Lends" positions={view.lends} />
          </div>
        </>
      );
    }
  }

  return (
    <>
      <div className="eyebrow">POSITION CONTROL CENTER</div>
      <h1 className="page-heading">Portfolio</h1>
      {content}
    </>
  );
}
