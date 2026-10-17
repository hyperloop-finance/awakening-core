import { describe, it, expect } from 'vitest';
import { hashOffer, offerTypedData, ratifierData, tickToPrice, priceToTick, type ChainOffer } from './offer-tree';
import { decodeAbiParameters, parseAbiParameters, zeroAddress } from 'viem';

const address=(n:string)=>`0x${n.padStart(40,'0')}` as `0x${string}`;
export const vector:ChainOffer={
  market:{loanToken:address('11'),collateralParams:[{token:address('22'),oracle:address('33')}],maturity:1793534400n,maxStrike:400n*10n**36n,penaltyPct:5n*10n**16n,enterGate:zeroAddress},
  buy:true,maker:address('44'),start:1790900000n,expiry:1791000000n,tick:4000n,group:`0x${'1'.padStart(64,'0')}`,callback:zeroAddress,callbackData:'0x',receiverIfMakerIsSeller:address('44'),ratifier:address('55'),reduceOnly:false,maxUnits:1000000000n,maxAssets:0n,
};
describe('contract-compatible OfferTree',()=>{
  it('matches the Solidity HashLib fixture including strike and penalty',()=>{
    expect(hashOffer(vector)).toBe('0xba59009c7191768c5729d78dfcee90a25d9c5cdc7c93aa3d1e71a114b21964cd');
    expect(hashOffer({...vector,tick:4001n})).not.toBe(hashOffer(vector));
    const typed=offerTypedData(vector);
    expect(typed.domain).toEqual({chainId:97,verifyingContract:address('55')});
  });
  it('matches Solidity tick rounding and rejects ticks outside the curve',()=>{
    expect(tickToPrice(2910n)).toBe(500000000000000000n);
    expect(tickToPrice(4000n)).toBe(995664000000000000n);
    expect(priceToTick(995664000000000000n,1n)).toBe(4000n);
    expect(()=>tickToPrice(5821n)).toThrow();
  });
  it('encodes v,r,s and a single leaf with no proof',()=>{
    const data=ratifierData(vector,`0x${'11'.repeat(32)}${'22'.repeat(32)}1b`);
    const decoded=decodeAbiParameters(parseAbiParameters('(uint8 v,bytes32 r,bytes32 s),bytes32,uint256,bytes32[]'),data);
    expect(decoded[0].v).toBe(27); expect(decoded[1]).toBe(hashOffer(vector));
    expect(decoded[2]).toBe(0n); expect(decoded[3]).toEqual([]);
  });
});
