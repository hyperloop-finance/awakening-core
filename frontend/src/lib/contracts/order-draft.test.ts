import {describe,it,expect} from 'vitest';
import {zeroAddress} from 'viem';
import {deployment} from './generated';
import {buildOrderOffer,minimumOrderCollateral,type OrderDraft} from './order-draft';
const draft:OrderDraft={marketId:deployment.markets[0].id,side:'BORROW',units:'500',tick:'4000',validityMinutes:'60'};
const now=BigInt(deployment.markets[0].market.maturity)-86400n;
const group=`0x${'1'.repeat(64)}` as const;
describe('deployed contract order fields',()=>{
  it('signs the entered tick and amount without an APR conversion or unsigned collateral term',()=>{
    const offer=buildOrderOffer(draft,deployment.deployer,4n,now,group);
    expect(offer).toMatchObject({buy:false,maxUnits:500000000n,maxAssets:0n,tick:4000n,start:now,expiry:now+3600n,group,callback:zeroAddress,callbackData:'0x',reduceOnly:false});
    expect(offer).not.toHaveProperty('collateral');expect(offer).not.toHaveProperty('ltv');
    expect(buildOrderOffer({...draft,side:'LEND'},deployment.deployer,4n,now,group).buy).toBe(true);
    expect(minimumOrderCollateral(offer)).toBe(1250000n);
  });
  it('rejects invalid ticks, amounts and lifetimes before any wallet request',()=>{
    for(const change of [{tick:'4001'},{tick:'5821'},{tick:'4.0'},{tick:'1e3'},{units:'0'},{units:'0.0000001'},{validityMinutes:'0'},{validityMinutes:'1.5'}])
      expect(()=>buildOrderOffer({...draft,...change},deployment.deployer,4n,now,group)).toThrow();
  });
  it('caps expiry before maturity and rejects a market too close to maturity',()=>{
    const maturity=BigInt(deployment.markets[0].market.maturity);
    expect(buildOrderOffer({...draft,validityMinutes:'9999'},deployment.deployer,4n,now,group).expiry).toBe(maturity-1n);
    expect(()=>buildOrderOffer(draft,deployment.deployer,4n,maturity-120n,group)).toThrow(/maturity/);
  });
});
