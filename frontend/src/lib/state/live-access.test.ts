import { expect, it } from 'vitest';
import { canTransact } from './live-access';
it('requires an account, BSC on both sides, verified contracts and an enabled integration',()=>{
  const ready={address:'0x1111111111111111111111111111111111111111',chainId:97,integrationEnabled:true,runtimeReady:true,runtimeChainId:97,contractsVerified:true};
  expect(canTransact(ready)).toBe(true);
  for(const change of [{address:undefined},{address:'not-an-address'},{chainId:56},{runtimeChainId:31337},{runtimeReady:false},{contractsVerified:false},{integrationEnabled:false}]){
    expect(canTransact({...ready,...change})).toBe(false);
  }
});
