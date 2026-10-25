import {ACTIVE_CHAIN_LABEL} from '@/lib/networks';
import {formatUnits} from 'viem';
import {type ChainOffer,hashOffer,tickToPrice} from '@/lib/contracts/offer-tree';
import {WalletModal} from '@/components/shell/wallet-modal';
import {minimumOrderCollateral} from '@/lib/contracts/order-draft';

export function OrderReview({offer,busy,error,onConfirm,onClose}:{offer:ChainOffer;busy:boolean;error?:string;onConfirm:()=>void;onClose:()=>void}){
  const time=(value:bigint)=>new Date(Number(value)*1000).toISOString().replace('T',' ').replace('.000Z',' UTC');
  return <WalletModal title="Review signed order" onClose={()=>{if(!busy)onClose();}}>
    <p className="wallet-help">{offer.buy?'Lend':'Borrow'} · BTC / USDC · {ACTIVE_CHAIN_LABEL}</p>
    <dl className="aw-order-review">
      <div><dt>{offer.buy?'Maximum credit':'Maximum debt'} · maxUnits</dt><dd>{formatUnits(offer.maxUnits,6)} USDC</dd></div>
      <div><dt>Price tick · tick</dt><dd>{offer.tick.toString()}</dd></div>
      <div><dt>Contract unit price</dt><dd>{formatUnits(tickToPrice(offer.tick),18)} USDC</dd></div>
      <div><dt>Starts · start</dt><dd>{time(offer.start)}</dd></div>
      <div><dt>Expires · expiry</dt><dd>{time(offer.expiry)}</dd></div>
      <div><dt>Market maturity</dt><dd>{time(offer.market.maturity)}</dd></div>
      <div><dt>Maximum strike</dt><dd>{formatUnits(offer.market.maxStrike*10n**8n,42)} USDC / BTC</dd></div>
      <div><dt>Asset cap · maxAssets</dt><dd>0 · Unit-capped order</dd></div>
      {!offer.buy&&<div><dt>BTC authorization</dt><dd>{formatUnits(minimumOrderCollateral(offer),8)} BTC · approval only</dd></div>}
    </dl>
    <p className="wallet-help">{offer.buy?'USDC spending and ratifier authorization may require transactions before the order signature.':'BTC spending and ratifier authorization may require transactions before the order signature. The BTC approval is calculated using the market’s maximum strike; fills requiring more collateral need additional approval.'} Collateral amount and LTV are not terms of this signed Offer.</p>
    <details className="aw-order-details"><summary>Exact signed Offer</summary><p className="aw-fine">Offer hash: {hashOffer(offer)}</p><pre>{JSON.stringify(offer,(_,value)=>typeof value==='bigint'?value.toString():value,2)}</pre></details>
    {error&&<p className="wallet-error" role="alert">{error}</p>}
    <button className="primary-button aw-order-confirm" disabled={busy} onClick={onConfirm}>{busy?'Check your wallet…':'Confirm & sign order'}</button>
  </WalletModal>;
}
