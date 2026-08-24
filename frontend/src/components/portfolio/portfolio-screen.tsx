"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { PortfolioPayload } from "@/lib/api/types";
import { derivePortfolioView } from "@/lib/state/flows";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";
import { useWalletIdentity } from "@/components/shell/wallet";

const usdc = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function PositionList({ title, positions }: { title: string; positions: ReturnType<typeof derivePortfolioView>["borrows"] }) {
  return <section className="glass-card"><div className="flow-panel"><h2>{title}</h2><p className="field-help">Fixed maturity positions</p></div><div className="position-list">{positions.map((position) => <div className="position-row" key={position.id}><div className="position-top"><strong>{position.marketId ?? "BTC / USDC"}</strong><span className={position.status.startsWith("Matured") ? "status status-matured" : "status"}>{position.status}</span></div><div className="position-meta"><span>{usdc.format(Number(position.principal))} USDC</span><span>Matures {new Date(position.maturity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>{position.settlementState === "MATURED" && <p className="field-help">Settlement is displayed for review only until deployment addresses are configured.</p>}</div>)}</div></section>;
}

export function PortfolioScreen() {
  const { wallet, isDemo, setDemoEnabled } = useWalletIdentity(); const [payload, setPayload] = useState<PortfolioPayload>(); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  const load = useCallback(() => { if (!wallet) return; setLoading(true); setError(undefined); awakeningApi.portfolio(wallet).then(setPayload).catch((reason) => setError(normalizeApiError(reason).message)).finally(() => setLoading(false)); }, [wallet]);
  useEffect(() => { setPayload(undefined); setError(undefined); if (wallet) load(); }, [wallet, load]);
  const view = error ? derivePortfolioView({ error }) : derivePortfolioView(payload);
  return <><div className="eyebrow">POSITION CONTROL CENTER</div><h1 className="page-heading">Portfolio</h1><p className="page-subtitle">Review isolated borrow and lend positions by their fixed maturity and settlement state. No repayment or settlement transaction is available in this preview release.</p>{view.kind === "disconnected" && <div style={{ marginTop: 28 }}><EmptyState title="Connect a wallet to view positions">Or <button className="inline-button" onClick={() => setDemoEnabled(true)}>enable the deterministic demo wallet</button> to inspect populated, matured, and empty states.</EmptyState></div>}{loading && <div style={{ marginTop: 28 }}><LoadingState label="Loading portfolio…" /></div>}{view.kind === "error" && <div style={{ marginTop: 28 }}><ErrorState message={view.message} retry={load} /></div>}{view.kind === "empty" && <div style={{ marginTop: 28 }}><EmptyState title="No active positions">Browse available BTC markets to begin an entirely simulated flow. <Link className="inline-button" href="/markets">Browse markets</Link></EmptyState></div>}{view.kind === "populated" && <><section className="overview-grid"><div className="glass-card metric"><span>BORROWED</span><strong>{usdc.format(Number(view.summary.totalBorrowed))} USDC</strong></div><div className="glass-card metric"><span>LENT</span><strong>{usdc.format(Number(view.summary.totalLent))} USDC</strong></div><div className="glass-card metric"><span>ACTIVE POSITIONS</span><strong>{view.summary.activePositions}</strong></div></section>{isDemo && <div className="demo-banner">Showing deterministic demo wallet data. <button className="inline-button" onClick={() => setDemoEnabled(false)}>Disconnect demo wallet</button></div>}<div className="positions-grid" style={{ marginTop: 20 }}><PositionList title="Borrows" positions={view.borrows} /><PositionList title="Lends" positions={view.lends} /></div></>}</>;
}
