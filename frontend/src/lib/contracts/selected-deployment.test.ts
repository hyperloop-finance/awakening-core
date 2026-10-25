import {expect,it} from 'vitest';
import {isAddress,zeroAddress} from 'viem';
import {ACTIVE_CHAIN_ID} from '../networks';
import {deployment} from './selected-deployment';
import {faucetTokens} from './faucet';
it('loads the selected real chain deployment and its five faucet assets',()=>{
  expect(Number(deployment.chainId)).toBe(ACTIVE_CHAIN_ID);
  for(const address of Object.values(deployment.contracts)) {
    expect(isAddress(address,{strict:false})).toBe(true);
    expect(address.toLowerCase()).not.toBe(zeroAddress);
  }
  expect(faucetTokens).toHaveLength(5);
  for(const token of faucetTokens)expect(isAddress(token.address,{strict:false})).toBe(true);
});
