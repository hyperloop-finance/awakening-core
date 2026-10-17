import {it,expect} from 'vitest';
import {deployment} from './generated';
import {trustedMarket,assertTrustedRuntime,decodeSignedOrder} from './live-model';
import {hashOffer,type ChainOffer} from './offer-tree';
import {zeroAddress} from 'viem';
it('only admits the configured deployment and market tuples',()=>{
  expect(trustedMarket(deployment.markets[0].id).maturity).toBe(1793534400n);
  expect(()=>trustedMarket('0x123')).toThrow();
  expect(()=>assertTrustedRuntime({profile:'bsc-testnet',chainId:56,contractsReady:true})).toThrow();
});
it('rejects a relay order with altered collateral terms even if its root is recomputed',()=>{
  const offer:ChainOffer={market:trustedMarket(deployment.markets[0].id),buy:true,maker:deployment.deployer,start:1n,expiry:2n,tick:4000n,group:`0x${'1'.repeat(64)}`,callback:zeroAddress,callbackData:'0x',receiverIfMakerIsSeller:deployment.deployer,ratifier:deployment.contracts.EcrecoverRatifier,reduceOnly:false,maxUnits:100n,maxAssets:0n};
  const wire=JSON.parse(JSON.stringify(offer,(_,v)=>typeof v==='bigint'?v.toString():v));
  const signed={marketId:deployment.markets[0].id,root:hashOffer(offer),offer:wire,signature:`0x${'1'.repeat(130)}`};
  expect(decodeSignedOrder(signed).market.maxStrike).toBe(400n*10n**36n);
  wire.market.maxStrike='1'; signed.root=hashOffer({...offer,market:{...offer.market,maxStrike:1n}});
  expect(()=>decodeSignedOrder(signed)).toThrow('market');
});
