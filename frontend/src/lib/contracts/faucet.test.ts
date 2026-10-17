import {expect,it} from 'vitest';
import {faucetCalldata,faucetTokens,isTrustedFaucetCall} from './faucet';
it('only trusts deployed tokens with exact faucet calldata',()=>{
  expect(faucetTokens).toHaveLength(5);
  for(const token of faucetTokens){
    expect(isTrustedFaucetCall(token.address,faucetCalldata)).toBe(true);
    expect(isTrustedFaucetCall(token.address,'0x')).toBe(false);
    expect(isTrustedFaucetCall(token.address,`${faucetCalldata}00`)).toBe(false);
  }
  expect(isTrustedFaucetCall('0x0000000000000000000000000000000000000001',faucetCalldata)).toBe(false);
});
