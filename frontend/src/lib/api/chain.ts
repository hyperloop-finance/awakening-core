import {ACTIVE_CHAIN_ID} from '@/lib/networks';
import type {Hex} from 'viem';
export type ChainMarketRow={id:Hex;label:string;purpose:string;market:{maturity:string;maxStrike:string};totalUnits:string;withdrawable:string;tickSpacing:string};
export type SignedChainOrder={root:Hex;marketId:Hex;signature:Hex;offer:Record<string,unknown>;ratifierData?:Hex};
export type ChainQuote={chainId:number;observedBlock:number;taker:string;units:string;collateral:string;buyerAssets:string;sellerAssetsBeforeProtection:string;settlementFee:string;price:string;expiresAt:string;order:SignedChainOrder};
export type ChainPosition={marketId:Hex;credit:string;debt:string;collateral:string;pendingFee:string};
export type ChainLoan={loanId:Hex;marketId:Hex;borrower:string;principal:string;lastRepaid:string;collateral:string;premium:string;expiry:string;pat:string;patTokenId:string;claimablePutProceeds:string};
export type ChainPending={pendingId:Hex;marketId:Hex;borrower:string;lender:string;units:string;collateral:string;escrowed:string;deadline:string};
export type ChainAccount={chainId:number;observedBlock:number;account:string;positions:ChainPosition[];loans:ChainLoan[];pendingTakes:ChainPending[]};
async function request<T>(path:string,init?:RequestInit):Promise<T> {
  const response=await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL??'http://127.0.0.1:8082'}/api/v1/chain${path}`,{...init,signal:init?.signal??AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.detail??data?.message??`Testnet request failed (${response.status}). Please retry.`);
  if(data?.chainId!==ACTIVE_CHAIN_ID)throw Error('Unexpected network response. No action was submitted.');
  return data as T;
}
export const chainApi={
  markets:(signal?:AbortSignal)=>request<{chainId:number;observedBlock:number;markets:ChainMarketRow[]}>('/markets',{signal}),
  account:(wallet:string,signal?:AbortSignal)=>request<ChainAccount>(`/accounts/${encodeURIComponent(wallet)}`,{signal}),
  orders:(maker?:string,signal?:AbortSignal)=>request<{chainId:number;orders:SignedChainOrder[]}>(`/orders${maker?`?maker=${encodeURIComponent(maker)}`:''}`,{signal}),
  create:(body:unknown)=>request<SignedChainOrder>('/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body,(_,v)=>typeof v==='bigint'?v.toString():v)}),
  quote:(root:Hex,units:bigint,collateral:bigint,taker:string)=>request<ChainQuote>(`/orders/${root}/quote?${new URLSearchParams({units:units.toString(),collateral:collateral.toString(),taker})}`),
};
