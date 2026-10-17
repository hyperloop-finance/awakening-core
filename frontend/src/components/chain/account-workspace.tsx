"use client";
import Image from 'next/image';
import Link from 'next/link';
import {useState,type ReactNode} from 'react';
import {formatUnits,type Hex} from 'viem';
import type {ChainAccount,ChainMarketRow,SignedChainOrder} from '@/lib/api/chain';
import {availablePayout} from '@/lib/contracts/transactions';
import {LoadingState} from '@/components/shell/states';

export type OrderDraft={marketId:string;side:'BORROW'|'LEND';units:string;collateral:string;apr:string};
type Action='repay'|'withdraw'|'collateral'|'residual'|'cancel';
export type AccountWorkspaceProps={page:'orders'|'positions'|'settlement';wallet?:string;canSign:boolean;busy:boolean;loading:boolean;error:string;markets:ChainMarketRow[];orders:SignedChainOrder[];account?:ChainAccount;feedback?:ReactNode;onRefresh:()=>void;onConnect:()=>void;onPlace:(draft:OrderDraft)=>void;onCancel:(order:SignedChainOrder)=>void;onSettle:(kind:Action,id:Hex,value:string,repayValue?:string)=>void};
const number=(v:string,decimals=6)=>{const [a,b]=formatUnits(BigInt(v),decimals).split('.');return a.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(b?`.${b}`:'');};
const date=(v:string)=>new Date(Number(v)*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const short=(v:string)=>`${v.slice(0,6)}…${v.slice(-4)}`;
function Pair(){return <span className="aw-pair"><span><Image src="/tokens/btc.svg" width={28} height={28} alt=""/><Image src="/tokens/usdc.svg" width={28} height={28} alt=""/></span><span><strong>BTC / USDC</strong><small>Fixed maturity</small></span></span>}
function Empty({children}:{children:ReactNode}){return <div className="aw-empty">{children}<Link href="/markets">Explore markets <span aria-hidden="true">↗</span></Link></div>}

export function AccountWorkspace(p:AccountWorkspaceProps){
  const {page,account,markets,orders,busy,canSign,onSettle}=p;
  const [side,setSide]=useState<'BORROW'|'LEND'>('BORROW'),[selected,setSelected]=useState(''),[units,setUnits]=useState('500'),[apr,setApr]=useState('5'),[collateral,setCollateral]=useState('0.0125');
  const [repay,setRepay]=useState<Record<string,string>>({});
  const now=Math.floor(Date.now()/1000),active=markets.filter(m=>Number(m.market.maturity)>now+120);
  const marketId=active.some(m=>m.id===selected)?selected:active[0]?.id??'';
  const loans=account?.loans.filter(l=>BigInt(l.principal)>0n)??[],positions=account?.positions??[];
  const remaining=(l:typeof loans[number])=>(BigInt(l.principal)-BigInt(l.lastRepaid)).toString();
  const payout=(id:string,credit:string)=>availablePayout(credit,markets.find(m=>m.id===id)?.withdrawable);
  const total=(key:'credit'|'debt'|'collateral')=>positions.reduce((sum,p)=>sum+BigInt(p[key]),0n).toString();
  const disabled=busy||!canSign;
  const title=page==='orders'?'Orders':page==='positions'?'Positions':'Settlement';
  return <div className="account-workspace">
    <header className="aw-heading"><div><h1>{title}</h1><p>{page==='orders'?'Your terms. Your next trade.':page==='positions'?'Your borrowing, lending and protection in one place.':'Repay your loans. Collect your proceeds.'}</p></div><button className="aw-refresh" disabled={busy||p.loading} onClick={p.onRefresh} aria-label="Refresh chain data"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></svg>Refresh</button></header>
    {p.feedback}
    {!p.wallet?<section className="aw-connect"><h2>Your account starts here</h2><p>Connect your wallet to view and manage your activity.</p><button className="primary-button" onClick={p.onConnect}>Connect wallet</button></section>:p.loading?<LoadingState/>:p.error?<div className="aw-empty" role="alert"><p>{p.error}</p><button className="secondary-button" onClick={p.onRefresh}>Try again</button></div>:<>
    {page==='orders'?<div className="aw-orders">
      <form className="aw-ticket" onSubmit={e=>{e.preventDefault();p.onPlace({marketId,side,units,collateral,apr})}}><h2>Place an order</h2><div className="aw-tabs">{(['BORROW','LEND'] as const).map(s=><button key={s} type="button" aria-pressed={side===s} onClick={()=>setSide(s)}>{s==='BORROW'?'Borrow':'Lend'}</button>)}</div>
        <label>Market<select value={marketId} onChange={e=>setSelected(e.target.value)}>{active.map(m=><option key={m.id} value={m.id}>{m.label} · {date(m.market.maturity)}</option>)}</select></label>
        <label>{side==='BORROW'?'Debt at maturity':'Credit at maturity'}<span className="aw-input"><input inputMode="decimal" required value={units} onChange={e=>setUnits(e.target.value)}/><span>USDC</span></span></label>
        <label>Fixed APR<span className="aw-input"><input inputMode="decimal" required value={apr} onChange={e=>setApr(e.target.value)}/><span>%</span></span></label>
        {side==='BORROW'&&<label>Collateral allowance<span className="aw-input"><input inputMode="decimal" required value={collateral} onChange={e=>setCollateral(e.target.value)}/><span>BTC</span></span></label>}
        <div className="aw-terms"><span>Order validity</span><strong>Up to 1 hour</strong></div><button className="primary-button" disabled={disabled||!marketId}>{busy?'Check your wallet…':'Approve & sign order'}</button><p className="aw-fine">APR rounds to the market tick. Protection premium is separate. Signed orders allow partial fills within your allowance.</p>
      </form>
      <section className="aw-ledger"><div className="aw-section-title"><h2>Your orders</h2><span>{orders.length}</span></div>{!orders.length?<Empty>No orders yet. Set your terms to get started.</Empty>:<div className="aw-table-wrap"><table aria-label="Your orders"><thead><tr><th>Market / side</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map(o=><tr key={o.root}><td><Pair/><small className="aw-detail">{o.offer.buy?'Lend':'Borrow'} · {short(o.root)}</small></td><td><strong>{number(String(o.offer.maxUnits))}</strong><small>USDC</small></td><td><span className="aw-tag">{Number(o.offer.expiry)<=now?'Expired':'Signed'}</span></td><td><button className="aw-text-button" disabled={disabled||Number(o.offer.expiry)<=now} onClick={()=>p.onCancel(o)}>Cancel order</button></td></tr>)}</tbody></table></div>}<p className="aw-fine">Signed-order history. Fillability and cancellations are checked on-chain when quoting.</p></section>
    </div>:!account?<Empty>Account data is not available yet. Refresh to try again.</Empty>:<>
      <div className="aw-summary"><div><span>Outstanding debt</span><strong>{number(total('debt'))}<small>USDC</small></strong></div><div><span>Lending balance</span><strong>{number(total('credit'))}<small>USDC</small></strong></div><div><span>Locked collateral</span><strong>{number(total('collateral'),8)}<small>BTC</small></strong></div></div>
      {page==='positions'?<>
      <section className="aw-ledger"><div className="aw-section-title"><h2>Borrow positions</h2><span>{loans.length}</span></div>{!loans.length?<Empty>No borrow positions yet.</Empty>:<div className="aw-table-wrap"><table aria-label="Borrow positions"><thead><tr>{['Market','Debt remaining','Collateral','Maturity','Protection','Status',''].map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{loans.map(l=><tr key={l.loanId}><td><Pair/></td><td><strong>{number(remaining(l))}</strong><small>USDC</small></td><td>{number(l.collateral,8)}<small>BTC · recorded at origination</small></td><td>{date(l.expiry)}</td><td>PAT #{l.patTokenId}<small>Simulated test protection</small></td><td><span className="aw-tag">{BigInt(remaining(l))===0n?'Repaid':Number(l.expiry)<=now?'Matured':'Active'}</span></td><td><Link className="aw-text-button" href="/settlement">Manage ↗</Link></td></tr>)}</tbody></table></div>}</section>
      <section className="aw-ledger"><div className="aw-section-title"><h2>Lend positions</h2><span>{positions.filter(p=>BigInt(p.credit)>0n).length}</span></div>{!positions.some(p=>BigInt(p.credit)>0n)?<Empty>No lend positions yet.</Empty>:<div className="aw-table-wrap"><table aria-label="Lend positions"><thead><tr><th>Market</th><th>Credit balance</th><th>Available payout</th><th>Maturity</th><th></th></tr></thead><tbody>{positions.filter(p=>BigInt(p.credit)>0n).map(p=><tr key={p.marketId}><td><Pair/></td><td><strong>{number(p.credit)}</strong><small>USDC</small></td><td>{number(payout(p.marketId,p.credit))}<small>USDC</small></td><td>{markets.find(m=>m.id===p.marketId)?date(markets.find(m=>m.id===p.marketId)!.market.maturity):'—'}</td><td><Link className="aw-text-button" href="/settlement">Manage ↗</Link></td></tr>)}</tbody></table></div>}</section>
      </>:<div className="aw-settlement-grid">
        <section className="aw-ledger"><div className="aw-section-title"><h2>Repay debt</h2><span>Borrowing</span></div>{!positions.some(p=>BigInt(p.debt)>0n)?<Empty>No outstanding debt.</Empty>:positions.filter(p=>BigInt(p.debt)>0n).map(pos=><article className="aw-settle-row" key={pos.marketId}><Pair/><div className="aw-balance"><span>Outstanding debt</span><strong>{number(pos.debt)} <small>USDC</small></strong></div><label className="aw-repay"><span>Amount to repay</span><span className="aw-input"><input aria-label="Repay amount in USDC" inputMode="decimal" value={repay[pos.marketId]??''} placeholder={formatUnits(BigInt(pos.debt),6)} onChange={e=>setRepay(v=>({...v,[pos.marketId]:e.target.value}))}/><button onClick={()=>setRepay(v=>({...v,[pos.marketId]:formatUnits(BigInt(pos.debt),6)}))}>Max</button><span>USDC</span></span></label><button className="primary-button" disabled={disabled} onClick={()=>onSettle('repay',pos.marketId,pos.debt,repay[pos.marketId]??'')}>Repay debt</button><p className="aw-fine">Full repayment automatically returns your loan collateral.</p></article>)}</section>
        <section className="aw-ledger"><div className="aw-section-title"><h2>Collect proceeds</h2><span>Lending & protection</span></div>{!positions.some(p=>BigInt(p.credit)>0n||BigInt(p.collateral)>0n&&BigInt(p.debt)===0n)&&!loans.some(l=>BigInt(l.claimablePutProceeds)>0n)?<Empty>No proceeds to collect yet.</Empty>:<>
          {positions.filter(p=>BigInt(p.credit)>0n).map(pos=><article className="aw-settle-row" key={pos.marketId}><Pair/><div className="aw-balance"><span>Available lender payout</span><strong>{number(payout(pos.marketId,pos.credit))} <small>USDC</small></strong></div><div className="aw-terms"><span>Total credit</span><strong>{number(pos.credit)} USDC</strong></div><button className="primary-button" disabled={disabled||BigInt(payout(pos.marketId,pos.credit))===0n} onClick={()=>onSettle('withdraw',pos.marketId,payout(pos.marketId,pos.credit))}>Claim payout</button><p className="aw-fine">Available funds update as borrowers repay and loans settle.</p></article>)}
          {loans.filter(l=>BigInt(l.claimablePutProceeds)>0n).map(l=><article className="aw-settle-row" key={l.loanId}><div className="aw-balance"><span>PAT #{l.patTokenId} · residual proceeds</span><strong>{number(l.claimablePutProceeds)} <small>USDC</small></strong></div><button className="secondary-button" disabled={disabled} onClick={()=>onSettle('residual',l.loanId,'0')}>Claim residual</button></article>)}
          {positions.filter(pos=>BigInt(pos.debt)===0n&&BigInt(pos.collateral)>0n).map(pos=><article className="aw-settle-row" key={`collateral-${pos.marketId}`}><div className="aw-balance"><span>Recoverable collateral</span><strong>{number(pos.collateral,8)} <small>BTC</small></strong></div><button className="secondary-button" disabled={disabled} onClick={()=>onSettle('collateral',pos.marketId,pos.collateral)}>Recover collateral</button></article>)}
        </>}</section>
      </div>}
      {!!account.pendingTakes.length&&<section className="aw-ledger"><div className="aw-section-title"><h2>Pending protection</h2><span>{account.pendingTakes.length}</span></div>{account.pendingTakes.map(t=><article className="aw-pending" key={t.pendingId}><div><strong>{number(t.units)} USDC</strong><p>Waiting for test protection completion · {number(t.collateral,8)} BTC escrowed</p></div><button className="secondary-button" disabled={disabled||Number(t.deadline)>=now} onClick={()=>onSettle('cancel',t.pendingId,'0')}>Cancel expired take</button></article>)}</section>}
      <footer className="aw-footer">BNB Testnet · Indexed block {account.observedBlock.toLocaleString('en-US')}<span>{short(p.wallet)}</span></footer>
    </>}
    {!canSign&&<p className="aw-fine">Connect on BNB Testnet with an active transaction runtime to submit transactions.</p>}
    </>}
  </div>;
}
