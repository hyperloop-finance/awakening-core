import { describe, expect, it } from 'vitest';
import { NETWORKS, isSupportedWalletChain } from './networks';

describe('supported wallet networks', () => {
  it('allows only BSC testnet, not mainnet or an unknown network', () => {
    expect(isSupportedWalletChain(97)).toBe(true);
    for (const chain of [undefined, 56, 1, 31337, 42161]) {
      expect(isSupportedWalletChain(chain)).toBe(false);
    }
    expect(NETWORKS.filter(n => n.status === 'enabled').map(n => n.key)).toEqual(['bsc-testnet']);
    expect(NETWORKS).toHaveLength(10);
  });
});
