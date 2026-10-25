"use client";
import {ACTIVE_CHAIN_ID, ACTIVE_CHAIN_LABEL} from '@/lib/networks';
import {useCallback,useEffect,useRef,useState} from 'react';
import {encodeFunctionData,formatUnits,toHex,type Hex} from 'viem';
import type {RuntimeConfig} from '@/lib/api/types';
import {chainApi,type ChainMarketRow,type SignedChainOrder,type ChainAccount,type ChainQuote} from '@/lib/api/chain';
import {deployment,awakeningAbi,awakeningSettlementAbi,ecrecoverRatifierAbi} from '@/lib/contracts/selected-deployment';
import {assertTrustedRuntime,decodeSignedOrder,trustedMarket} from '@/lib/contracts/live-model';
import {hashOffer,ratifierData,type ChainOffer} from '@/lib/contracts/offer-tree';
import {buildOrderOffer,minimumOrderCollateral} from '@/lib/contracts/order-draft';
import {parseTokenAmount,repaymentAmount,actionErrorMessage} from '@/lib/contracts/transactions';
import {useWalletIdentity} from '@/components/shell/wallet';
import {useChainWallet} from './use-chain-wallet';
import {ChainMarkets} from './chain-markets';
import {AccountWorkspace,type OrderDraft} from './account-workspace';
import {OrderReview} from './order-review';
import {ActionToast} from './action-toast';

const core=deployment.contracts.Awakening;
const amount=(value:string,decimals=6)=>formatUnits(BigInt(value),decimals);
const short=(value:string)=>`${value.slice(0,8)}…${value.slice(-6)}`;
const errorText=actionErrorMessage;

export function ChainWorkspace({pathname,config}:{pathname:string;config:RuntimeConfig}) {
  const page=pathname.split('/')[1]||'markets';
  const {wallet,chainId,openWallet}=useWalletIdentity();
  const signing=useChainWallet(config);
  const [markets,setMarkets]=useState<ChainMarketRow[]>([]),[orders,setOrders]=useState<SignedChainOrder[]>([]);
  const [account,setAccount]=useState<ChainAccount>(),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [dataError,setDataError]=useState(''),[observedBlock,setObservedBlock]=useState<number>();
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const lock=useRef(false),mounted=useRef(true);
  const [units,setUnits]=useState('1000'),[collateral,setCollateral]=useState('0.025');
  const [selected,setSelected]=useState<SignedChainOrder>(),[quote,setQuote]=useState<ChainQuote>();
  const [orderReview,setOrderReview]=useState<{marketId:string;offer:ChainOffer}>();
  const canSign=!!wallet&&chainId===ACTIVE_CHAIN_ID&&config.transactionsEnabled===true&&config.verificationStatus==='VERIFIED';
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setDataError('');
    try {assertTrustedRuntime(config);}catch(e){setDataError(errorText(e));setLoading(false);return()=>controller.abort();}
    Promise.all([chainApi.markets(controller.signal),chainApi.orders(page==='orders'?wallet:undefined,controller.signal),
      wallet&&['positions','portfolio','settlement'].includes(page)?chainApi.account(wallet,controller.signal):Promise.resolve(undefined)])
      .then(([m,o,a])=>{if(!controller.signal.aborted){setMarkets(m.markets);setObservedBlock(m.observedBlock);setOrders(o.orders);setAccount(a);}})
      .catch(e=>{if(!controller.signal.aborted)setDataError(errorText(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[wallet,page,reload,config]);
  const refresh=useCallback(()=>setReload(n=>n+1),[]);
  const dismissNotice=useCallback(()=>{setError('');setNotice('');},[]);
  useEffect(()=>{
    if(signing.status?.stage!=='indexing')return;
    let attempts=0;
    const timer=setInterval(()=>{refresh();if(++attempts>=12)clearInterval(timer)},5000);
    return()=>clearInterval(timer);
  },[signing.status,refresh]);
  async function action(work:()=>Promise<void>,refreshAfter=true) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');signing.clearStatus();
    try {await work();if(mounted.current&&refreshAfter)refresh();}catch(e){if(mounted.current)setError(errorText(e));}
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  async function placeOrder(draft:OrderDraft) {
    const s=signing.session(),row=markets.find(m=>m.id===draft.marketId);
    if(!row)throw Error('Select an initialized market.');
    const block=await s.publicClient.getBlock();s.check();const now=block.timestamp;
    const offer=buildOrderOffer(draft,s.account,BigInt(row.tickSpacing),now,toHex(crypto.getRandomValues(new Uint8Array(32))));
    setOrderReview({marketId:draft.marketId,offer});
  }
  async function confirmOrder() {
    if(!orderReview)throw Error('Review an order first.');
    const {offer,marketId}=orderReview;
    const s=signing.session();
    if(offer.maker.toLowerCase()!==s.account.toLowerCase())throw Error('Wallet changed. Review the order again.');
    const assertActive=async()=>{const block=await s.publicClient.getBlock();s.check();if(block.timestamp>offer.expiry||block.timestamp>=offer.market.maturity)throw Error('Order preview expired. Close it and review a new order.');};
    await assertActive();
    if(offer.buy)await s.approve(offer.market.loanToken,offer.maxUnits);
    else await s.approve(offer.market.collateralParams[0].token,minimumOrderCollateral(offer));
    const authorized=await s.publicClient.readContract({address:core,abi:awakeningAbi,functionName:'isAuthorized',args:[s.account,deployment.contracts.EcrecoverRatifier]});s.check();
    if(!authorized)await s.tx(core,encodeFunctionData({abi:awakeningAbi,functionName:'setIsAuthorized',args:[deployment.contracts.EcrecoverRatifier,true,s.account]}));
    await assertActive();
    const signature=await s.sign(offer);s.check();
    await chainApi.create({chainId:ACTIVE_CHAIN_ID,awakeningAddress:core,marketId,root:hashOffer(offer),offer,signature});s.check();
    setOrderReview(undefined);
    setNotice(`Signed order saved. Expires ${new Date(Number(offer.expiry)*1000).toISOString()}. Cancellation requires an on-chain transaction.`);
  }
  async function cancel(order:SignedChainOrder) {
    const s=signing.session(),offer=decodeSignedOrder(order);
    if(offer.maker.toLowerCase()!==s.account.toLowerCase())throw Error('Only the maker can cancel this order.');
    await s.tx(deployment.contracts.EcrecoverRatifier,encodeFunctionData({abi:ecrecoverRatifierAbi,functionName:'cancelRoot',args:[s.account,order.root]}));
    const cancelled=await s.publicClient.readContract({address:deployment.contracts.EcrecoverRatifier,abi:ecrecoverRatifierAbi,functionName:'isRootCanceled',args:[s.account,order.root]});s.check();
    if(!cancelled)throw Error('Cancellation has not been confirmed.');setNotice('Order cancellation confirmed on-chain. Stored signature retained for your history.');
  }
  async function getQuote() {
    if(!selected||!wallet)throw Error('Connect your wallet and select an order.');
    const s=signing.session();const q=await chainApi.quote(selected.root,parseTokenAmount(units,6),parseTokenAmount(collateral,8),s.account);s.check();
    decodeSignedOrder(q.order);setQuote(q);
  }
  async function take() {
    if(!selected||!quote)throw Error('Request a fresh quote first.');
    const s=signing.session(),offer=decodeSignedOrder(quote.order);
    if(quote.order.root!==selected.root||quote.taker.toLowerCase()!==s.account.toLowerCase())throw Error('Quote identity changed. Request a new quote.');
    const face=parseTokenAmount(units,6),locked=parseTokenAmount(collateral,8);
    if(face.toString()!==quote.units||locked.toString()!==quote.collateral)throw Error('Amounts changed. Request a new quote.');
    await s.approve(offer.buy?offer.market.collateralParams[0].token:offer.market.loanToken,offer.buy?locked:BigInt(quote.buyerAssets));
    const fresh=await chainApi.quote(selected.root,face,locked,s.account);s.check();
    if(fresh.buyerAssets!==quote.buyerAssets||fresh.sellerAssetsBeforeProtection!==quote.sellerAssetsBeforeProtection)throw Error('Quote changed after approval. Review a new quote.');
    await s.tx(core,encodeFunctionData({abi:awakeningAbi,functionName:'takeInit',args:[offer,ratifierData(offer,quote.order.signature),face,locked,s.account]}));
    s.check();setQuote(undefined);setNotice('Funds escrowed. The loan is pending test protection; it is not active until the operator completes it. See Positions after indexing.');
  }
  async function settlement(kind:'repay'|'withdraw'|'collateral'|'residual'|'cancel',id:Hex,value:string,repayValue?:string) {
    const s=signing.session();let to:Hex=core,data:Hex;
    if(kind==='repay') {
      const market=trustedMarket(id),face=repaymentAmount(repayValue??'',value);await s.approve(market.loanToken,face);
      to=deployment.contracts.AwakeningSettlement;data=encodeFunctionData({abi:awakeningSettlementAbi,functionName:'repay',args:[id,face]});
    } else if(kind==='withdraw')data=encodeFunctionData({abi:awakeningAbi,functionName:'withdraw',args:[trustedMarket(id),BigInt(value),s.account,s.account]});
    else if(kind==='collateral')data=encodeFunctionData({abi:awakeningAbi,functionName:'withdrawCollateral',args:[trustedMarket(id),0n,BigInt(value),s.account,s.account]});
    else if(kind==='residual')data=encodeFunctionData({abi:awakeningAbi,functionName:'claimPutProceeds',args:[id,s.account]});
    else data=encodeFunctionData({abi:awakeningAbi,functionName:'cancelTake',args:[id]});
    await s.tx(to,data);s.check();setNotice('Transaction confirmed. Refresh after the indexed block catches up.');
  }
  function choose(row:ChainMarketRow,borrow:boolean) {
    const candidates=orders.filter(o=>o.marketId===row.id&&o.offer.buy===borrow&&o.offer.maker?.toString().toLowerCase()!==wallet?.toLowerCase()&&BigInt(String(o.offer.expiry))>BigInt(Math.floor(Date.now()/1000)));
    if(!candidates.length){setError('No matching signed orders are available. A counterparty must place an order first.');return;}
    setSelected(candidates[0]);setQuote(undefined);setError('');
  }
  const title=page==='markets'||page==='borrow'||page==='lend'?'Markets':page==='orders'?'Orders':page==='settlement'?'Settlement':'Positions';
  const personal=title!=='Markets';
  if(personal)return <AccountWorkspace
    page={title==='Orders'?'orders':title==='Settlement'?'settlement':'positions'} wallet={wallet}
    canSign={canSign} busy={busy} loading={loading} error={dataError} markets={markets} orders={orders} account={account}
    onConnect={openWallet} onRefresh={refresh} onPlace={draft=>void action(()=>placeOrder(draft),false)}
    onCancel={order=>void action(()=>cancel(order))}
    onSettle={(kind,id,value,repayValue)=>void action(()=>settlement(kind,id,value,repayValue))}
    feedback={<>
      {orderReview&&<OrderReview offer={orderReview.offer} busy={busy} error={error} onConfirm={()=>void action(confirmOrder)} onClose={()=>{setOrderReview(undefined);setError('');}}/>}
      {!orderReview&&(error||notice)&&<ActionToast message={error||notice} error={!!error} onClose={dismissNotice}/>}
    </>}/>;
  return <div className="chain-workspace">
    <ChainMarkets markets={markets} loading={loading} error={dataError} observedBlock={observedBlock} busy={busy} canSign={canSign} onRefresh={refresh} onChoose={choose}/>
    {(error||notice)&&<ActionToast message={error||notice} error={!!error} onClose={dismissNotice}/>}
      {selected&&<section className="inline-execution" aria-label={`${selected.offer.buy?'Borrow':'Lend'} execution`}><div className="inline-execution-head"><div><span>{ACTIVE_CHAIN_LABEL.toUpperCase()} EXECUTION</span><h2>{selected.offer.buy?'Borrow':'Lend'} without leaving the market</h2></div><button className="inline-button" disabled={busy} onClick={()=>{setSelected(undefined);setQuote(undefined)}}>Close</button></div><div className="instrument-panel order-ticket"><h2>{selected.offer.buy?'Borrow':'Lend'} · tBTC / tUSDC</h2><label>Counterparty order<select value={selected.root} onChange={e=>{setSelected(orders.find(o=>o.root===e.target.value));setQuote(undefined)}}>{orders.filter(o=>o.marketId===selected.marketId&&o.offer.buy===selected.offer.buy&&String(o.offer.maker).toLowerCase()!==wallet?.toLowerCase()).map(o=><option key={o.root} value={o.root}>{short(String(o.offer.maker))} · {amount(String(o.offer.maxUnits))} tUSDC · {short(o.root)}</option>)}</select></label><label>Debt / credit units at maturity · tUSDC<input value={units} onChange={e=>{setUnits(e.target.value);setQuote(undefined)}} inputMode="decimal"/></label><label>Collateral escrow · tBTC<input value={collateral} onChange={e=>{setCollateral(e.target.value);setQuote(undefined)}} inputMode="decimal"/></label>
        <button className="secondary-button" disabled={busy||!canSign} onClick={()=>void action(getQuote)}>Get executable quote</button>
        {quote&&<><dl className="wallet-details"><div><dt>Lender supplies</dt><dd>{amount(quote.buyerAssets)} tUSDC</dd></div><div><dt>Borrower receives before protection premium</dt><dd>{amount(quote.sellerAssetsBeforeProtection)} tUSDC</dd></div><div><dt>Debt due at maturity</dt><dd>{amount(quote.units)} tUSDC</dd></div></dl><p className="chain-note">Protection completion is a separate test-operator action. Its premium reduces borrower proceeds. Expired pending takes can be cancelled.</p><button className="primary-button" disabled={busy||!canSign} onClick={()=>void action(take)}>Approve &amp; submit take</button></>}
      </div></section>}
    {!canSign&&<p className="chain-note">{!wallet?`Connect a wallet on ${ACTIVE_CHAIN_LABEL} to transact.`:chainId!==ACTIVE_CHAIN_ID?`Switch to ${ACTIVE_CHAIN_LABEL} in the wallet menu.`:'Transaction activation is pending end-to-end testnet verification.'}</p>}
  </div>;
}
