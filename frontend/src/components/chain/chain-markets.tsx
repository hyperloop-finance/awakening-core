"use client";

import Image from 'next/image';
import {useState} from 'react';
import {formatUnits} from 'viem';
import type {ChainMarketRow} from '@/lib/api/chain';
import {deployment} from '@/lib/contracts/generated';
import {EmptyState,ErrorState,LoadingState} from '@/components/shell/states';

// Reuse the original Markets visual language. Values come only from the chain read model.
const units=(value:bigint,decimals=6)=>{
  const [whole,fraction]=formatUnits(value,decimals).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction?`.${fraction}`:'');
};
const maturity=(value:string)=>`${new Date(Number(value)*1000).toISOString().slice(0,10)} UTC`;

type Props={
  markets:ChainMarketRow[];loading:boolean;error:string;observedBlock?:number;
  busy:boolean;canSign:boolean;onRefresh:()=>void;onChoose:(market:ChainMarketRow,borrow:boolean)=>void;
};

export function ChainMarkets({markets,loading,error,observedBlock,busy,canSign,onRefresh,onChoose}:Props) {
  const [query,setQuery]=useState('');
  const now=BigInt(Math.floor(Date.now()/1000));
  const ready=!loading&&!error;
  const visible=ready?markets.filter(m=>`${m.label} ${m.id} ${maturity(m.market.maturity)}`.toLowerCase().includes(query.trim().toLowerCase())):[];
  const upcoming=markets.map(m=>BigInt(m.market.maturity)).filter(t=>t>now).sort((a,b)=>a<b?-1:a>b?1:0)[0];
  const totalCredit=markets.reduce((sum,m)=>sum+BigInt(m.totalUnits),0n);
  return <>
    <section className="markets-hero" aria-labelledby="markets-title">
      <div className="markets-hero-copy">
        <div className="hero-title-line"><h1 className="page-heading" id="markets-title">Borrow against crypto.<br/><span>Never get liquidated.</span></h1></div>
        <p className="page-subtitle">Fixed-rate, fixed-maturity credit for crypto. Every quote carries explicit put attribution, with no health checks or margin calls during the term.</p>
        <div className="invariant-panel" aria-label="Protocol repayment invariant">
          <span className="invariant-label">THE INVARIANT</span>
          <div className="invariant-equation"><span>min(S, K)</span><i>+</i><span>max(K − S, 0)</span><i>=</i><strong>K</strong></div>
          <p>collateral value + put payoff = protected repayment at maturity</p>
        </div>
      </div>
      <section className="market-overview" aria-label="Market overview">
        <div className="metric"><span>Total credit</span><strong>{ready?`${units(totalCredit)} tUSDC`:'—'}</strong><small>outstanding units on BNB Testnet</small></div>
        <div className="metric"><span>Market count</span><strong>{ready?markets.length:'—'}</strong><small>{ready&&observedBlock?`indexed block ${observedBlock.toLocaleString('en-US')}`:'initialized testnet markets'}</small></div>
        <div className="metric"><span>Average fixed APR</span><strong>—</strong><small>quoted per executable order</small></div>
        <div className="metric"><span>Next maturity</span><strong>{ready&&upcoming?maturity(upcoming.toString()):'—'}</strong><small>next future settlement date</small></div>
      </section>
    </section>

    <section className="markets-section" aria-labelledby="market-catalog-title">
      <div className="section-heading">
        <div><h2 id="market-catalog-title">Markets</h2><p>Fixed-maturity markets from BNB Testnet. Test assets and simulated PAT protection.</p></div>
        <div className="market-filter">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
          <input className="filter-input" aria-label="Filter markets" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search markets…"/>
        </div>
      </div>
      {loading&&<LoadingState/>}
      {!loading&&error&&<ErrorState message={error} retry={onRefresh}/>}
      {ready&&markets.length===0&&<EmptyState title="No markets available">No initialized markets were returned by the testnet index.</EmptyState>}
      {ready&&markets.length>0&&visible.length===0&&<EmptyState title="No markets match this filter"><button className="inline-button" onClick={()=>setQuery('')}>Clear search</button></EmptyState>}
      {visible.length>0&&<div className="market-table"><table aria-label="Available markets">
        <thead><tr>{['MARKET','FIXED APR','MATURITY','AVAILABLE','UTILIZATION','STRIKE / PAT','STATUS','ACTIONS'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.map(row=>{
          const expired=BigInt(row.market.maturity)<=now;
          const configured=deployment.markets.find(m=>m.id===row.id);
          const knownPair=configured?.market.loanToken===deployment.testAssets.loan.address&&configured?.market.collateralParams[0].token===deployment.testAssets.collateral.address;
          return <tr key={row.id}>
            <th scope="row" className="market-name">
              <span className="asset-pair">
                {knownPair&&<><Image className="asset-symbol" src="/tokens/btc.svg" alt="Bitcoin test token" width={25} height={25}/><Image className="asset-symbol asset-overlap" src="/tokens/usdc.svg" alt="USD Coin test token" width={25} height={25}/></>}
                <b>{row.label}</b>
              </span>
              <span className="market-meta">{row.purpose==='normal'?'Fixed-maturity credit':'Short-expiry test market'}</span>
            </th>
            <td data-label="Fixed APR"><span className="rate-badge">—</span><small className="market-meta compact">{expired?'Matured':'Quote required'}</small></td>
            <td data-label="Maturity">{maturity(row.market.maturity)}</td>
            <td data-label="Available">—<small className="market-meta compact">{expired?'Market closed':'Verified on quote'}</small></td>
            <td data-label="Utilization">—<small className="market-meta compact">Order-based market</small></td>
            <td data-label="Strike / PAT"><strong>{units(BigInt(row.market.maxStrike)*10n**8n/10n**36n)} tUSDC</strong><small className="market-meta compact">Max strike · simulated PAT</small></td>
            <td data-label="Status"><span className={`status-badge status-${expired?'matured':'open'}`}><i aria-hidden="true"/>{expired?'MATURED':'OPEN'}</span></td>
            <td data-label="Actions" className="market-action-cell"><span className="market-actions">
              <button className="small-action" disabled={!canSign||busy||expired} onClick={()=>onChoose(row,true)}>Borrow now</button>
              <button className="small-action" disabled={!canSign||busy||expired} onClick={()=>onChoose(row,false)}>Lend now</button>
            </span></td>
          </tr>;
        })}</tbody>
      </table></div>}
      <div className="chain-market-source"><p>Rates and available amounts require a valid counterparty quote. Test protection has no real-world backing.</p><button className="inline-button" disabled={loading||busy} onClick={onRefresh}>Refresh chain data</button></div>
    </section>
  </>;
}
