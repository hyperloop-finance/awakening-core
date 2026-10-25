import {afterEach,expect,it,vi} from 'vitest';
import type {ChainOffer} from './contracts/offer-tree';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules();});
it.each([['arbitrum-sepolia',421614],['robinhood-testnet',46630]] as const)('binds signatures and API responses to %s',async(profile,chainId)=>{
  vi.stubEnv('NEXT_PUBLIC_TESTNET',profile);vi.resetModules();
  const {offerTypedData}=await import('./contracts/offer-tree');
  const offer={ratifier:'0x1111111111111111111111111111111111111111'} as unknown as ChainOffer;
  expect(offerTypedData(offer).domain).toEqual({chainId,verifyingContract:offer.ratifier});
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({chainId:97,markets:[]})});
  vi.stubGlobal('fetch',fetch);
  const {chainApi}=await import('./api/chain');
  await expect(chainApi.markets()).rejects.toThrow('Unexpected network');
  fetch.mockResolvedValue({ok:true,json:async()=>({chainId,markets:[]})});
  await expect(chainApi.markets()).resolves.toEqual({chainId,markets:[]});
  const {executeWalletTransaction}=await import('./contracts/transactions');
  const write=vi.fn();
  await expect(executeWalletTransaction({chainId:97,identity:'a',current:()=> 'a',simulate:vi.fn(),write,receipt:vi.fn(),stage:vi.fn()})).rejects.toThrow('Switch your wallet');
  expect(write).not.toHaveBeenCalled();
});
