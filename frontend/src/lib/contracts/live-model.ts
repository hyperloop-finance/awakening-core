import {isAddress,zeroAddress,type Address,type Hex} from 'viem';
import {deployment} from './generated';
import {hashOffer,type ChainMarket,type ChainOffer} from './offer-tree';
import type {RuntimeConfig} from '../api/types';

const record=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Invalid order object');return x as Record<string,unknown>};
const integer=(x:unknown)=>{if(typeof x!=='string'||!/^(0|[1-9]\d{0,77})$/.test(x)||BigInt(x)>=2n**256n)throw Error('Invalid integer');return BigInt(x)};
const addr=(x:unknown):Address=>{if(typeof x!=='string'||!isAddress(x,{strict:false}))throw Error('Invalid address');return x as Address};
const hex=(x:unknown,bytes:number):Hex=>{if(typeof x!=='string'||!new RegExp(`^0x[0-9a-fA-F]{${bytes*2}}$`).test(x))throw Error('Invalid hex');return x as Hex};
const bool=(x:unknown)=>{if(typeof x!=='boolean')throw Error('Invalid boolean');return x};
export function trustedMarket(id:string):ChainMarket {
  const item=deployment.markets.find(m=>m.id.toLowerCase()===id.toLowerCase());
  if(!item)throw Error('Unknown testnet market');
  return {...item.market,collateralParams:item.market.collateralParams.map(c=>({...c})),maturity:BigInt(item.market.maturity),maxStrike:BigInt(item.market.maxStrike),penaltyPct:BigInt(item.market.penaltyPct)};
}
export function assertTrustedRuntime(config:Partial<RuntimeConfig>) {
  if(config.profile!=='bsc-testnet'||config.chainId!==97||!config.contractsReady||config.verificationStatus!=='VERIFIED')throw Error('Verified BNB Testnet configuration is unavailable.');
  const pairs=[['awakeningAddress','Awakening'],['settlementAddress','AwakeningSettlement'],['patAddress','AttestedPAT'],['optionVaultAddress','OptionVault'],['ratifierAddress','EcrecoverRatifier']] as const;
  for(const [key,name]of pairs)if(config[key]?.toLowerCase()!==deployment.contracts[name].toLowerCase())throw Error('Unexpected contract deployment.');
}
export function decodeSignedOrder(input:unknown):ChainOffer {
  const signed=record(input),o=record(signed.offer),m=record(o.market);
  const expected=trustedMarket(String(signed.marketId));
  const cp=m.collateralParams;
  if(!Array.isArray(cp)||cp.length!==1)throw Error('Unsupported market collateral');
  const actual:ChainMarket={loanToken:addr(m.loanToken),collateralParams:cp.map(c=>({token:addr(record(c).token),oracle:addr(record(c).oracle)})),maturity:integer(m.maturity),maxStrike:integer(m.maxStrike),penaltyPct:integer(m.penaltyPct),enterGate:addr(m.enterGate)};
  const stringify=(x:unknown)=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v).toLowerCase();
  if(stringify(actual)!==stringify(expected))throw Error('Order market does not match trusted deployment');
  const offer:ChainOffer={market:expected,buy:bool(o.buy),maker:addr(o.maker),start:integer(o.start),expiry:integer(o.expiry),tick:integer(o.tick),group:hex(o.group,32),callback:addr(o.callback),callbackData:hex(o.callbackData,0),receiverIfMakerIsSeller:addr(o.receiverIfMakerIsSeller),ratifier:addr(o.ratifier),reduceOnly:bool(o.reduceOnly),maxUnits:integer(o.maxUnits),maxAssets:integer(o.maxAssets)};
  if(offer.callback!==zeroAddress||offer.reduceOnly||offer.ratifier.toLowerCase()!==deployment.contracts.EcrecoverRatifier||offer.maxAssets!==0n||offer.maxUnits<=0n||offer.receiverIfMakerIsSeller.toLowerCase()!==offer.maker.toLowerCase())throw Error('Unsupported order permissions');
  if(hashOffer(offer).toLowerCase()!==hex(signed.root,32).toLowerCase())throw Error('Order root mismatch');
  hex(signed.signature,65);return offer;
}
