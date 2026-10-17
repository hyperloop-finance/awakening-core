import { http } from 'viem';
import { createConfig } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : [])],
  transports: {
    [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL ?? 'https://bsc-testnet.bnbchain.org', { timeout: 10_000, retryCount: 1 }),
  },
  ssr: true,
});
