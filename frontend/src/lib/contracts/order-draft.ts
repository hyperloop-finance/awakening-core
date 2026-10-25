import {zeroAddress,type Address,type Hex} from 'viem';
import {deployment} from './selected-deployment';
import {trustedMarket} from './live-model';
import {type ChainOffer} from './offer-tree';
import {parseTokenAmount} from './transactions';

export type OrderDraft={marketId:string;side:'BORROW'|'LEND';units:string;tick:string;validityMinutes:string};

export function minimumOrderCollateral(offer:ChainOffer):bigint {
  return (offer.maxUnits*10n**36n+offer.market.maxStrike-1n)/offer.market.maxStrike;
}

/** Build the exact unit-capped Offer supported by the deployed ratifier and relay. */
export function buildOrderOffer(draft:OrderDraft,maker:Address,spacing:bigint,now:bigint,group:Hex):ChainOffer {
  const market=trustedMarket(draft.marketId);
  if(draft.side!=='BORROW'&&draft.side!=='LEND')throw Error('Select Borrow or Lend.');
  const maxUnits=parseTokenAmount(draft.units,6);
  if(!/^(0|[1-9]\d{0,3})$/.test(draft.tick))throw Error('Price tick must be a whole number from 0 to 5820.');
  const tick=BigInt(draft.tick);
  if(tick>5820n||spacing<=0n||5820n%spacing!==0n||tick%spacing!==0n)throw Error(`Price tick must be a multiple of ${spacing}, from 0 to 5820.`);
  if(!/^[1-9]\d{0,6}$/.test(draft.validityMinutes))throw Error('Order validity must be a positive number of whole minutes.');
  if(market.maturity<=now+120n)throw Error('This market is too close to maturity. Select another market.');
  const requestedExpiry=now+BigInt(draft.validityMinutes)*60n;
  const expiry=requestedExpiry<market.maturity?requestedExpiry:market.maturity-1n;
  return {market,buy:draft.side==='LEND',maker,start:now,expiry,tick,group,
    callback:zeroAddress,callbackData:'0x',receiverIfMakerIsSeller:maker,
    ratifier:deployment.contracts.EcrecoverRatifier,reduceOnly:false,maxUnits,maxAssets:0n};
}
