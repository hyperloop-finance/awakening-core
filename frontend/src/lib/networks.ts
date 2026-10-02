export type NetworkEntry = {
  key: string;
  label: string;
  environment: 'mainnet' | 'testnet';
  status: 'enabled' | 'coming-soon';
  chainId?: number;
};

export const ACTIVE_CHAIN_ID = 97;
export const NETWORKS: readonly NetworkEntry[] = [
  { key: 'bsc-testnet', label: 'BNB Testnet', environment: 'testnet', status: 'enabled', chainId: 97 },
  ...['BNB', 'Arbitrum', 'Robinhood', 'Arc', 'Solana'].flatMap(label =>
    (['mainnet', 'testnet'] as const)
      .filter(environment => label !== 'BNB' || environment !== 'testnet')
      .map(environment => ({
        key: `${label.toLowerCase()}-${environment}`,
        label: `${label} ${environment === 'mainnet' ? 'Mainnet' : 'Testnet'}`,
        environment,
        status: 'coming-soon' as const,
      }))),
];

export function isSupportedWalletChain(chainId?: number) {
  return chainId === ACTIVE_CHAIN_ID;
}
