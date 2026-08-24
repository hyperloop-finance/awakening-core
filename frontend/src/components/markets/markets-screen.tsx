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
  return <><div className="eyebrow">FIXED RATE · FIXED MATURITY · BTC COLLATERAL</div><h1 className="page-heading">BTC credit without interim liquidations.</h1><p className="page-subtitle">Explore BTC / USDC markets. Positions remain previews until contract addresses are configured.</p><section><div className="section-heading"><div><h2>Markets</h2><p>Filter by market identifier or maturity.</p></div><div style={{ width: 240 }}><input className="filter-input" aria-label="Filter markets" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets…" /></div></div>{!markets && !error && <LoadingState />}{error && <ErrorState message={error} retry={load} />}{markets && !filtered.length && <EmptyState title="No BTC markets match this filter">Clear the search to see available markets.</EmptyState>}{markets && filtered.length > 0 && <div className="glass-card market-table" role="table"><div className="market-row" role="row"><span role="columnheader">MARKET</span><span role="columnheader">APR</span><span role="columnheader">MATURITY</span><span role="columnheader">AVAILABLE</span><span role="columnheader">UTILIZATION</span><span role="columnheader">OFFERS</span><span /></div>{filtered.map((market) => <div className="market-row" role="row" key={market.id}><span role="cell" className="market-name">{market.collateralAsset} / {market.principalAsset}<span className="market-meta">PAT coverage preview</span></span><span role="cell">{market.fixedApr}%</span><span role="cell">{new Date(market.maturity).toISOString().slice(0,10)} UTC</span><span role="cell">{money.format(Number(market.availableLiquidity))} USDC</span><span role="cell">{market.utilization}%</span><span role="cell">{market.offerDepth}</span><span className="market-actions"><Link className="small-action" href={`/borrow/${market.id}`}>Borrow</Link><Link className="small-action" href={`/lend/${market.id}`}>Lend</Link></span></div>)}</div>}</section></>;
}
