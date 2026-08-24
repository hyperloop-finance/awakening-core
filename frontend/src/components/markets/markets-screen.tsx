"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { MarketSummary } from "@/lib/api/types";
import { filterMarkets } from "@/lib/state/flows";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function MarketsScreen() {
  const [markets, setMarkets] = useState<MarketSummary[]>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const load = useCallback(() => { setMarkets(undefined); setError(undefined); awakeningApi.markets().then(setMarkets).catch((reason) => setError(normalizeApiError(reason).message)); }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = markets ? filterMarkets(markets, query) : [];
  return <><div className="eyebrow">FIXED RATE · FIXED MATURITY · BTC COLLATERAL</div><h1 className="page-heading">BTC credit without interim liquidations.</h1><p className="page-subtitle">Explore deterministic BTC / USDC markets. Every position is fixed-rate and presented as a simulation until all local or testnet contract addresses are configured.</p><section className="overview-grid"><div className="glass-card metric"><span>PROFILE</span><strong>Mock data</strong></div><div className="glass-card metric"><span>COLLATERAL</span><strong>BTC only</strong></div><div className="glass-card metric"><span>NETWORK PATH</span><strong>Local / Sepolia</strong></div></section><section><div className="section-heading"><div><h2>Markets</h2><p>Filter by market identifier or maturity.</p></div><div style={{ width: 240 }}><input className="filter-input" aria-label="Filter markets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets…" /></div></div>{!markets && !error && <LoadingState />}{error && <ErrorState message={error} retry={load} />}{markets && !filtered.length && <EmptyState title="No BTC markets match this filter">Clear the search to see the available mock catalog.</EmptyState>}{markets && filtered.length > 0 && <div className="glass-card market-table"><div className="market-row" style={{ color: "var(--muted)", fontSize: 11, letterSpacing: ".08em" }}><span>MARKET</span><span>STRIKE</span><span>APR</span><span>MATURITY</span><span>AVAILABLE</span><span>UTILIZATION</span><span /></div>{filtered.map((market) => <div className="market-row" key={market.id}><span className="market-name">{market.label}<span className="market-meta">PAT coverage preview · {market.offerDepth} offers</span></span><span>${money.format(Number(market.strike))}</span><span>{market.fixedApr}%</span><span>{new Date(market.maturity).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span><span>{money.format(Number(market.availableLiquidity))} USDC</span><span>{market.utilization}%</span><span className="market-actions"><Link className="small-action" href={`/borrow/${market.id}`}>Borrow</Link><Link className="small-action" href={`/lend/${market.id}`}>Lend</Link></span></div>)}</div>}</section></>;
}
