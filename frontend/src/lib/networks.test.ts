import {afterEach, describe, expect, it, vi} from 'vitest';
import { NETWORKS, isSupportedWalletChain } from './networks';
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
describe('supported wallet networks', () => {
  it('preserves the historical BSC test profile while hiding it from public selection',()=>{
    expect(isSupportedWalletChain(97)).toBe(true);
    expect(isSupportedWalletChain(56)).toBe(false);
    expect(NETWORKS.filter(n=>n.status==='enabled').map(n=>n.chainId)).toEqual([421614,46630]);
    expect(NETWORKS.some(n=>n.label.includes('BNB'))).toBe(false);
  });
  it.each([['arbitrum-sepolia',421614,''],['robinhood-testnet',46630,'/robinhood']] as const)('isolates the %s build',async(profile,id,prefix)=>{
    vi.stubEnv('NEXT_PUBLIC_TESTNET',profile);vi.resetModules();
    const network=await import('./networks');
    expect(network.ACTIVE_CHAIN_ID).toBe(id);
    expect(network.isSupportedWalletChain(id)).toBe(true);
    expect(network.isSupportedWalletChain(97)).toBe(false);
    expect(network.assetPath('/tokens/btc.svg')).toBe(`${prefix}/tokens/btc.svg`);
    expect(network.ACTIVE_CHAIN.nativeCurrency.symbol).toBe('ETH');
  });
});
