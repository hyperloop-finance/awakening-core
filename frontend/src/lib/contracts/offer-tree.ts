import {ACTIVE_CHAIN_ID} from '@/lib/networks';
import { encodeAbiParameters, hashStruct, parseAbiParameters, parseSignature, type Address, type Hex } from 'viem';

export type ChainMarket = {
  loanToken:Address; collateralParams:{token:Address;oracle:Address}[];
  maturity:bigint; maxStrike:bigint; penaltyPct:bigint; enterGate:Address;
};
export type ChainOffer = {
  market:ChainMarket; buy:boolean; maker:Address; start:bigint; expiry:bigint; tick:bigint;
  group:Hex; callback:Address; callbackData:Hex; receiverIfMakerIsSeller:Address;
  ratifier:Address; reduceOnly:boolean; maxUnits:bigint; maxAssets:bigint;
};
export const offerTypes={
  CollateralParams:[{name:'token',type:'address'},{name:'oracle',type:'address'}],
  Market:[{name:'loanToken',type:'address'},{name:'collateralParams',type:'CollateralParams[]'},
    {name:'maturity',type:'uint256'},{name:'maxStrike',type:'uint256'},{name:'penaltyPct',type:'uint256'},{name:'enterGate',type:'address'}],
  Offer:[{name:'market',type:'Market'},{name:'buy',type:'bool'},{name:'maker',type:'address'},
    {name:'start',type:'uint256'},{name:'expiry',type:'uint256'},{name:'tick',type:'uint256'},
    {name:'group',type:'bytes32'},{name:'callback',type:'address'},{name:'callbackData',type:'bytes'},
    {name:'receiverIfMakerIsSeller',type:'address'},{name:'ratifier',type:'address'},{name:'reduceOnly',type:'bool'},
    {name:'maxUnits',type:'uint256'},{name:'maxAssets',type:'uint256'}],
  OfferTree:[{name:'offerTree',type:'Offer'}],
} as const;
export function hashOffer(offer:ChainOffer):Hex {
  return hashStruct({data:offer,primaryType:'Offer',types:offerTypes});
}
export function offerTypedData(offer:ChainOffer) {
  return {domain:{chainId:ACTIVE_CHAIN_ID,verifyingContract:offer.ratifier},types:offerTypes,primaryType:'OfferTree' as const,message:{offerTree:offer}};
}
export function ratifierData(offer:ChainOffer,signature:Hex):Hex {
  const sig=parseSignature(signature);
  return encodeAbiParameters(parseAbiParameters('(uint8 v,bytes32 r,bytes32 s),bytes32,uint256,bytes32[]'),
    [{v:Number(sig.v??BigInt(27+(sig.yParity??0))),r:sig.r,s:sig.s},hashOffer(offer),0n,[]]);
}
const WAD=10n**18n;
function wExp(x:bigint):bigint {
  if(x<0n)return WAD*WAD/wExp(-x);
  const ln2=693147180559945309n,q=(x+322611214989459870n)/ln2,r=x-q*ln2;
  const second=r*r/(2n*WAD),third=second*r/(3n*WAD);
  return (WAD+r+second+third)<<q;
}
const halfDown=(x:bigint,d:bigint)=>(x+(d-1n)/2n)/d;
export function tickToPrice(tick:bigint):bigint {
  if(tick<0n||tick>5820n)throw Error('Tick outside contract curve');
  return halfDown(halfDown(WAD*WAD,WAD+wExp(4987541511039073n*(2910n-tick))),10n**12n)*10n**12n;
}
export function priceToTick(price:bigint,spacing:bigint):bigint {
  if(price<0n||price>WAD||spacing<=0n||5820n%spacing!==0n)throw Error('Invalid price or tick spacing');
  let low=0n,high=5820n;
  while(low<high){const mid=(low+high)/2n;if(tickToPrice(mid)<price)low=mid+1n;else high=mid;}
  return (low+spacing-1n)/spacing*spacing;
}
