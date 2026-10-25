"use client";
import {useState} from 'react';
import {formatUnits,toHex} from 'viem';
import type {ChainMarketRow} from '@/lib/api/chain';
import {deployment} from '@/lib/contracts/selected-deployment';
import {trustedMarket} from '@/lib/contracts/live-model';
import {buildOrderOffer,type OrderDraft} from '@/lib/contracts/order-draft';
import {tickToPrice} from '@/lib/contracts/offer-tree';

export function ChainOrderTicket({markets,disabled,busy,onPlace}:{
  markets:ChainMarketRow[];disabled:boolean;busy:boolean;onPlace:(draft:OrderDraft)=>void;
}){
  const [side,setSide]=useState<'BORROW'|'LEND'>('BORROW');
  const [selected,setSelected]=useState('');
  const [units,setUnits]=useState('500'),[tick,setTick]=useState('4000'),[validityMinutes,setValidity]=useState('60');
  const [error,setError]=useState('');
  const now=BigInt(Math.floor(Date.now()/1000));
  const active=markets.filter(m=>BigInt(m.market.maturity)>now+120n);
  const row=active.find(m=>m.id===selected)??active[0];
  const market=row?trustedMarket(row.id):undefined;
  const validTick=/^\d{1,4}$/.test(tick)&&BigInt(tick)<=5820n;
  const price=validTick?formatUnits(tickToPrice(BigInt(tick)),18):'—';
  const timestamp=(value:bigint)=>new Date(Number(value)*1000).toISOString().replace('T',' ').replace('.000Z',' UTC');
  return <div className="aw-order-editor"><form className="aw-ticket" onSubmit={event=>{
    event.preventDefault();setError('');
    if(!row)return;
    const draft:OrderDraft={marketId:row.id,side,units,tick,validityMinutes};
    try{buildOrderOffer(draft,deployment.deployer,BigInt(row.tickSpacing),now,toHex(0,{size:32}));onPlace(draft);}
    catch(reason){setError(reason instanceof Error?reason.message:'Check your order parameters.');}
  }}><h2>Place an order</h2>
    <div className="aw-tabs">{(['BORROW','LEND'] as const).map(value=><button key={value} type="button" aria-pressed={side===value} disabled={busy} onClick={()=>{setSide(value);setError('');}}>{value==='BORROW'?'Borrow':'Lend'}</button>)}</div>
    <label>Market<select value={row?.id??''} disabled={busy} onChange={event=>{setSelected(event.target.value);setError('');}}>{active.map(m=><option key={m.id} value={m.id}>{m.label} · {new Date(Number(m.market.maturity)*1000).toISOString().slice(0,10)}</option>)}</select></label>
    <label>{side==='BORROW'?'Maximum debt at maturity':'Maximum credit at maturity'}<span className="aw-input"><input inputMode="decimal" required value={units} disabled={busy} onChange={event=>setUnits(event.target.value)}/><span>USDC</span></span><small>Signed as maxUnits. This is the face value due at maturity.</small></label>
    <label>Price tick<span className="aw-input"><input inputMode="numeric" required value={tick} disabled={busy} onChange={event=>setTick(event.target.value)}/><span>tick</span></span><small>0–5820 · multiples of {row?.tickSpacing??'—'}. Signed exactly as entered.</small></label>
    <div className="aw-terms"><span>Contract unit price</span><strong>{price} USDC</strong></div>
    <label>Order validity<span className="aw-input"><input inputMode="numeric" required value={validityMinutes} disabled={busy} onChange={event=>setValidity(event.target.value)}/><span>minutes</span></span><small>Starts at the latest block time. Expiry is capped before market maturity.</small></label>
    {market&&<details className="aw-order-details"><summary>Fixed market terms</summary><dl>
      <div><dt>Maturity</dt><dd>{timestamp(market.maturity)}</dd></div>
      <div><dt>Maximum strike</dt><dd>{formatUnits(market.maxStrike*10n**8n,42)} USDC / BTC</dd></div>
      <div><dt>Penalty</dt><dd>{formatUnits(market.penaltyPct,16)}%</dd></div>
      <div><dt>Side · buy</dt><dd>{side==='LEND'?'true · Lend':'false · Borrow'}</dd></div>
    </dl><p>LTV is not a signed order field. Collateral and strike are determined at execution, within this market’s maximum strike.</p></details>}
    {error&&<p className="chain-message" role="alert">{error}</p>}
    <button className="primary-button" disabled={disabled||!row}>{busy?'Check your wallet…':'Review order'}</button>
    <p className="aw-fine">Review the exact signed Offer before approving or signing. Orders support partial fills. Protection premium and settlement fees are separate.</p>
  </form>
  </div>;
}
