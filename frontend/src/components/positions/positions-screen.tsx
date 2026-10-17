"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { PositionPayload, PositionSummary } from "@/lib/api/types";
import { formatDecimal, formatUtcDate } from "@/lib/format";
import { formatRateAsPercent } from "@/lib/fixed-decimal";
import { useWalletIdentity } from "@/components/shell/wallet";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";

function Ledger({ title, positions }: { title: string; positions: PositionSummary[] }) {
  return <section className="position-section"><div className="position-section-head"><h2>{title}</h2><span>{positions.length} POSITION{positions.length === 1 ? "" : "S"}</span></div><div className="position-table-wrap"><table className="position-table"><thead><tr><th>MARKET / POSITION</th><th>UNITS / FACE VALUE</th><th>COLLATERAL / STRIKE</th><th>PAT PROTECTION</th><th>MATURITY</th></tr></thead><tbody>{positions.map((position) => <tr key={position.id}><th><span className="position-market">BTC / USDC · {position.side}</span><span className="position-id">{position.id}</span></th><td>{position.side === "BORROW" ? <>{formatDecimal(position.debtUnits)} debt units</> : <>{formatDecimal(position.creditUnits)} credit units<br/><small>{formatDecimal(position.faceValue)} USDC face value</small></>}</td><td>{position.side === "BORROW" && <>{formatDecimal(position.collateral, 8)} BTC<br/></>}<small>{formatDecimal(position.strike)} USDC strike</small></td><td><span className="status-badge status-open">{position.patStatus}</span><small>{formatRateAsPercent(position.patCoverage)} coverage</small></td><td>{formatUtcDate(position.maturity)} UTC<br/><small>{formatRateAsPercent(position.fixedApr)} fixed APR</small></td></tr>)}</tbody></table></div></section>;
}

export function PositionsScreen() {
  const { wallet, openWallet } = useWalletIdentity(); const [payload, setPayload] = useState<PositionPayload>(); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>();
  const load = useCallback(async () => { if (!wallet) return; setLoading(true); setError(undefined); try { setPayload(await awakeningApi.positions(wallet)); } catch (reason) { setError(normalizeApiError(reason).message); } finally { setLoading(false); } }, [wallet]);
  useEffect(() => { void load(); }, [load]);
  return <><header className="portfolio-hero"><div className="portfolio-title-line"><h1 className="page-heading">Positions</h1><span className="preview-status"><span />CREDIT, DEBT &amp; PAT ATTRIBUTION</span></div><p className="page-subtitle">Inspect what the protocol owes, what you owe, the collateral attached, and the protection supporting maturity settlement.</p></header>
    {!wallet ? <EmptyState title="Connect a wallet to view positions"><button className="inline-button" onClick={() => openWallet()}>Connect wallet</button></EmptyState> : loading ? <LoadingState label="Loading positions…" /> : error ? <ErrorState message={error} retry={load} /> : !payload || (!payload.borrowPositions.length && !payload.lendPositions.length) ? <EmptyState title="No positions"><Link className="inline-button" href="/markets">Browse markets</Link></EmptyState> : <><section className="portfolio-summary"><div className="summary-lead"><strong>Protected fixed-maturity positions</strong><span>{payload.profile.toUpperCase()} · PREVIEW DATA</span><small>PAT states are illustrative until chain indexing is connected.</small></div><div className="metric"><span>DEBT OUTSTANDING</span><strong>{formatDecimal(payload.totals.debtOutstanding)} USDC</strong></div><div className="metric"><span>CREDIT FACE VALUE</span><strong>{formatDecimal(payload.totals.creditFaceValue)} USDC</strong></div><div className="metric"><span>BTC LOCKED</span><strong>{formatDecimal(payload.totals.collateralLocked, 8)}</strong></div></section><div className="positions-ledger"><Ledger title="Borrow positions" positions={payload.borrowPositions}/><Ledger title="Lend positions" positions={payload.lendPositions}/></div></>}
  </>;
}
